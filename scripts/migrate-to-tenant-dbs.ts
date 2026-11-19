/**
 * Copy the old shared database into one database per tenant.
 * Dry-run is the default. Pass --apply to write.
 *
 *   npm run migrate:tenants
 *   npm run migrate:tenants -- --apply
 *   npm run migrate:tenants -- --map 674abc...=abc --source training_platform
 *
 * A map value is either oldId=slug or a file of those lines.
 * The old collections are never deleted. Cleanup instructions are printed at the end.
 */
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { resolve } from "node:path";

import mongoose from "mongoose";

import {
  assertMigrationSource,
  chooseSlug,
  collidingSlugs,
  countAssignments,
  countsMatch,
  parseTenantMap,
  sourceDatabaseName,
  type MigrationCounts,
} from "../src/lib/migrate-plan";

type OldDoc = {
  _id: unknown;
  name?: unknown;
  slug?: unknown;
  status?: unknown;
  createdAt?: unknown;
  tenantId?: unknown;
  keycloakUserId?: unknown;
  assignments?: unknown;
  video?: { storedFileName?: unknown };
};

type PlannedTenant = {
  id: string;
  name: string;
  status: "active" | "disabled";
  createdAt?: Date;
  slug: string;
  slugSource: "map" | "stored" | "name";
  courses: OldDoc[];
  staff: OldDoc[];
};

function loadEnvFiles() {
  for (const filename of [".env", ".env.local"]) {
    const filePath = resolve(process.cwd(), filename);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  const maps: string[] = [];
  let apply = false;
  let source: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg === "--source") {
      source = argv[index + 1];
      index += 1;
    } else if (arg === "--map") {
      const value = argv[index + 1];
      if (!value) throw new Error("--map needs a file path or oldId=slug");
      maps.push(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument ${arg}`);
    }
  }
  return { apply, source, maps };
}

function loadMaps(values: string[]): Map<string, string> {
  const combined = new Map<string, string>();
  for (const value of values) {
    const text = existsSync(value) ? readFileSync(value, "utf8") : value;
    if (!existsSync(value) && !value.includes("=")) {
      throw new Error(`Map file not found: ${value}`);
    }
    for (const [id, slug] of parseTenantMap(text)) {
      const previous = combined.get(id);
      if (previous && previous !== slug) throw new Error(`Map key ${id} is listed twice`);
      combined.set(id, slug);
    }
  }
  return combined;
}

function idString(value: unknown): string {
  return String(value);
}

function withoutTenantId(doc: OldDoc): Record<string, unknown> {
  const copy = { ...doc } as Record<string, unknown>;
  delete copy.tenantId;
  return copy;
}

function namespaceExists(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code: unknown }).code === 48) return true;
  if ("cause" in error) return namespaceExists((error as { cause: unknown }).cause);
  return false;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function moveVideo(source: string, dest: string): Promise<"moved" | "present" | "missing"> {
  if (await fileExists(dest)) return "present";
  if (!(await fileExists(source))) return "missing";
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    await rename(source, dest);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await copyFile(source, dest);
    await unlink(source);
  }
  return "moved";
}

function cleanupText(source: string, platform: string, prefix: string): string {
  return [
    `Old database "${source}" was not deleted.`,
    "After the new databases match this report, drop the old one manually:",
    `  mongosh --eval "db.getSiblingDB('${source}').dropDatabase()"`,
    `Do not drop ${platform} or any ${prefix}<slug> database.`,
    "Moved videos now live in MEDIA_DIR/<slug>/. Files that were not referenced were left in place.",
    "A running server picks up a new slug within 60 seconds.",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvFiles();

  const { connectDB, getPlatformModels, getTenantModels, provisionTenantDatabase } = await import("../src/lib/db");
  const { listRealmUsers, setUserTenantSlug } = await import("../src/lib/keycloak-admin");
  const { mediaRoot, resolveStoredFile } = await import("../src/lib/media");
  const { dbPrefix, platformDbName, tenantMediaDir } = await import("../src/lib/tenant");

  const sourceName = assertMigrationSource(
    sourceDatabaseName({
      explicit: args.source,
      databaseEnv: process.env.MONGODB_DATABASE,
      uri: process.env.MONGODB_URI,
    }),
    platformDbName(),
    dbPrefix(),
  );

  const connection = await connectDB();
  const source = connection.connection.getClient().db(sourceName);
  const collectionNames = new Set((await source.listCollections().toArray()).map((entry) => entry.name));
  if (!collectionNames.has("tenants")) {
    console.log(`No tenants collection in ${sourceName}. Nothing to migrate.`);
    console.log(cleanupText(sourceName, platformDbName(), dbPrefix()));
    return;
  }

  const oldTenants = await source.collection<OldDoc>("tenants").find().toArray();
  const map = loadMaps(args.maps);
  const planned: PlannedTenant[] = [];

  for (const tenant of oldTenants) {
    const id = idString(tenant._id);
    const name = typeof tenant.name === "string" ? tenant.name.trim() : "";
    if (!name) throw new Error(`Tenant ${id} has no name`);
    const choice = chooseSlug({
      name,
      storedSlug: typeof tenant.slug === "string" ? tenant.slug : null,
      mapped: map.get(id.toLowerCase()) ?? null,
    });
    const courses = await source
      .collection<OldDoc>("courses")
      .find({ $or: [{ tenantId: tenant._id }, { tenantId: id }] })
      .toArray();
    const staff = collectionNames.has("staff")
      ? await source
          .collection<OldDoc>("staff")
          .find({ $or: [{ tenantId: tenant._id }, { tenantId: id }] })
          .toArray()
      : [];
    planned.push({
      id,
      name,
      status: tenant.status === "disabled" ? "disabled" : "active",
      createdAt: tenant.createdAt instanceof Date ? tenant.createdAt : undefined,
      slug: choice.slug,
      slugSource: choice.source,
      courses,
      staff,
    });
  }

  const collisions = collidingSlugs(planned.map((tenant) => tenant.slug));
  if (collisions.length > 0) {
    throw new Error(`Slug collision: ${collisions.join(", ")}. Pass --map oldId=slug to separate them.`);
  }

  console.log(`${args.apply ? "Apply" : "Dry run"} from ${sourceName}. ${planned.length} tenant(s).`);
  if (planned.length === 0) {
    console.log(cleanupText(sourceName, platformDbName(), dbPrefix()));
    return;
  }

  let realmUsers: Awaited<ReturnType<typeof listRealmUsers>> = [];
  try {
    realmUsers = await listRealmUsers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keycloak unavailable";
    if (args.apply) throw new Error(message);
    console.log(`Keycloak was not read (${message}). Apply will stop until it is reachable.`);
    process.exitCode = 1;
  }

  const { Tenant } = await getPlatformModels();
  const root = mediaRoot();
  let failed = false;

  for (const tenant of planned) {
    const before: MigrationCounts = {
      courses: tenant.courses.length,
      staff: tenant.staff.length,
      assignments: countAssignments(tenant.staff),
      files: tenant.courses.length,
    };
    const mediaDir = tenantMediaDir(tenant.slug);
    const videoPaths = tenant.courses.map((course) => {
      const stored = course.video?.storedFileName;
      if (typeof stored !== "string" || stored.length === 0) {
        return { stored: "", source: "", dest: "", ready: false };
      }
      const sourcePath = resolveStoredFile(root, path.basename(stored));
      const destPath = resolveStoredFile(mediaDir, path.basename(stored));
      return { stored, source: sourcePath, dest: destPath, ready: true };
    });

    let filesReady = 0;
    for (const video of videoPaths) {
      if (!video.ready) continue;
      if ((await fileExists(video.dest)) || (await fileExists(video.source))) filesReady += 1;
    }

    const registry = await Tenant.findOne({ slug: tenant.slug }).lean();
    const models = registry ? await getTenantModels(tenant.slug) : null;
    const destCourseIds = new Set(
      models ? (await models.Course.find().select("_id").lean()).map((course) => idString(course._id)) : [],
    );
    const destStaffIds = new Set(
      models ? (await models.Staff.find().select("_id").lean()).map((person) => idString(person._id)) : [],
    );
    const extraCourses = [...destCourseIds].filter((id) => !tenant.courses.some((course) => idString(course._id) === id)).length;
    const extraStaff = [...destStaffIds].filter((id) => !tenant.staff.some((person) => idString(person._id) === id)).length;

    const keycloakIds = new Set<string>();
    for (const person of tenant.staff) {
      const userId = typeof person.keycloakUserId === "string" ? person.keycloakUserId : "";
      if (!userId || userId.startsWith("pending:")) continue;
      keycloakIds.add(userId);
    }
    for (const user of realmUsers) {
      if (user.attributes?.tenantId?.[0] === tenant.id) keycloakIds.add(user.id);
    }

    console.log(`\n${tenant.slug} (${tenant.slugSource}, old id ${tenant.id})`);
    console.log(`  courses ${before.courses}, staff ${before.staff}, assignments ${before.assignments}, files ready ${filesReady}/${before.files}`);
    console.log(`  keycloak users ${keycloakIds.size}`);
    if (extraCourses > 0 || extraStaff > 0) {
      console.log(`  abort: ${tenant.slug} already has ${extraCourses} courses and ${extraStaff} staff that are not in ${sourceName}`);
      failed = true;
      if (args.apply) break;
      continue;
    }
    if (filesReady !== before.files) {
      console.log("  abort: a course video is missing from the old media folder and the tenant folder");
      failed = true;
      if (args.apply) break;
      continue;
    }

    if (!args.apply) {
      console.log("  dry run: no data was written");
      continue;
    }

    if (!registry) {
      await Tenant.create({
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        ...(tenant.createdAt ? { createdAt: tenant.createdAt } : {}),
      });
    }

    try {
      await provisionTenantDatabase(tenant.slug);
    } catch (error) {
      if (!namespaceExists(error)) throw error;
      const existing = await getTenantModels(tenant.slug);
      for (const model of [existing.Course, existing.Staff]) {
        try {
          await model.createCollection();
        } catch (inner) {
          if (!namespaceExists(inner)) throw inner;
        }
        await model.syncIndexes();
      }
    }

    const destination = await getTenantModels(tenant.slug);
    const courseInserts = tenant.courses
      .filter((course) => !destCourseIds.has(idString(course._id)))
      .map((course) => withoutTenantId(course));
    const staffInserts = tenant.staff
      .filter((person) => !destStaffIds.has(idString(person._id)))
      .map((person) => withoutTenantId(person));
    if (courseInserts.length > 0) {
      await destination.Course.collection.insertMany(courseInserts as never[]);
    }
    if (staffInserts.length > 0) {
      await destination.Staff.collection.insertMany(staffInserts as never[]);
    }

    let moved = 0;
    for (const video of videoPaths) {
      const result = await moveVideo(video.source, video.dest);
      if (result === "missing") throw new Error(`Missing video for ${tenant.slug}: ${video.stored}`);
      if (result === "moved") moved += 1;
    }

    let keycloakUpdated = 0;
    for (const userId of keycloakIds) {
      const current = realmUsers.find((user) => user.id === userId)?.attributes?.tenantId?.[0] ?? null;
      if (current && current !== tenant.id && current !== tenant.slug) {
        console.log(`  skip keycloak ${userId}: already assigned to ${current}`);
        continue;
      }
      const result = await setUserTenantSlug(userId, tenant.slug);
      if (result === "updated") keycloakUpdated += 1;
    }

    const afterCourses = await destination.Course.find().select("_id").lean();
    const afterStaff = await destination.Staff.find().select("assignments").lean();
    let filesAfter = 0;
    for (const video of videoPaths) {
      if (await fileExists(video.dest)) filesAfter += 1;
    }
    const after: MigrationCounts = {
      courses: afterCourses.length,
      staff: afterStaff.length,
      assignments: countAssignments(afterStaff),
      files: filesAfter,
    };
    console.log(
      `  after courses ${after.courses}, staff ${after.staff}, assignments ${after.assignments}, files ${after.files}, moved ${moved}, keycloak updated ${keycloakUpdated}`,
    );
    if (!countsMatch(before, after)) {
      console.log("  abort: counts do not match. Old collections were left in place.");
      failed = true;
      break;
    }
  }

  console.log(`\n${cleanupText(sourceName, platformDbName(), dbPrefix())}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
