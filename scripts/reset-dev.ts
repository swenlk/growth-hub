/**
 * Wipe leftover test data in the old shared database and loose video files.
 * Tenant databases (growth_hub_<slug>) and per-tenant media folders are left alone.
 *
 *   npm run reset:dev
 *   npm run reset:dev -- --yes
 */
import { existsSync, readFileSync } from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { resolve } from "node:path";

import mongoose from "mongoose";

import { assertMigrationSource, sourceDatabaseName } from "../src/lib/migrate-plan";

const OLD_COLLECTIONS = ["tenants", "courses", "staff"] as const;

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

async function main() {
  const yes = process.argv.slice(2).includes("--yes");
  if (process.argv.slice(2).some((arg) => arg !== "--yes")) {
    throw new Error("Unknown argument. The only flag is --yes.");
  }
  loadEnvFiles();

  const { connectDB } = await import("../src/lib/db");
  const { mediaRoot } = await import("../src/lib/media");
  const { dbPrefix, platformDbName } = await import("../src/lib/tenant");

  const sourceName = assertMigrationSource(
    sourceDatabaseName({
      databaseEnv: process.env.MONGODB_DATABASE,
      uri: process.env.MONGODB_URI,
    }),
    platformDbName(),
    dbPrefix(),
  );
  const connection = await connectDB();
  const source = connection.connection.getClient().db(sourceName);
  const names = new Set((await source.listCollections().toArray()).map((entry) => entry.name));
  const root = mediaRoot();
  const looseFiles: string[] = [];
  if (existsSync(root)) {
    for (const entry of await readdir(root)) {
      const full = path.join(root, entry);
      const info = await stat(full);
      if (info.isFile()) looseFiles.push(entry);
    }
  }

  console.log(`Old database: ${sourceName}`);
  console.log(`Collections: ${OLD_COLLECTIONS.filter((name) => names.has(name)).join(", ") || "(none)"}`);
  console.log(`Loose media files: ${looseFiles.length}`);
  console.log(`${platformDbName()} and ${dbPrefix()}<slug> databases are not touched.`);
  console.log("Per-tenant media folders are not touched.");

  if (!yes) {
    console.log("Dry run. Pass --yes to delete the old collections and loose media files.");
    return;
  }

  for (const name of OLD_COLLECTIONS) {
    if (!names.has(name)) continue;
    await source.collection(name).drop();
    console.log(`Dropped ${sourceName}.${name}`);
  }
  for (const entry of looseFiles) {
    await unlink(path.join(root, entry));
    console.log(`Removed ${entry}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
