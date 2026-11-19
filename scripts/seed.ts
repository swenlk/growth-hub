/**
 * Create sample tenants through the same provisioning path as the app.
 * The Keycloak tenantId attribute is the slug. Re-running skips rows that already exist.
 *
 *   npm run seed
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

const TENANTS = [
  {
    name: "Abc Training",
    slug: "abc",
    adminName: "Abc Admin",
    adminEmail: "admin@abc.test",
    staff: { name: "Abc Staff", email: "staff@abc.test" },
  },
  {
    name: "Xyz Training",
    slug: "xyz",
    adminName: "Xyz Admin",
    adminEmail: "admin@xyz.test",
    staff: { name: "Xyz Staff", email: "staff@xyz.test" },
  },
] as const;

function loadEnvFiles() {
  for (const filename of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

async function main() {
  loadEnvFiles();
  const { getPlatformModels, getTenantModels } = await import("../src/lib/db");
  const { createStaffMember } = await import("../src/lib/staff-directory");
  const { createTenantWithAdmin } = await import("../src/lib/tenants");

  const { Tenant } = await getPlatformModels();

  for (const spec of TENANTS) {
    const existing = await Tenant.exists({ slug: spec.slug });
    if (existing) {
      console.log(`${spec.slug}: organization already exists`);
    } else {
      const created = await createTenantWithAdmin({
        name: spec.name,
        slug: spec.slug,
        adminName: spec.adminName,
        adminEmail: spec.adminEmail,
      });
      console.log(`${created.slug} admin ${created.email}`);
      console.log(`temporary password: ${created.temporaryPassword}`);
    }

    const models = await getTenantModels(spec.slug);
    const staffExists = await models.Staff.exists({ email: spec.staff.email });
    if (staffExists) {
      console.log(`${spec.slug}: staff ${spec.staff.email} already exists`);
      continue;
    }

    const staff = await createStaffMember({ slug: spec.slug, models }, spec.staff);
    console.log(`${spec.slug} staff ${staff.email}`);
    console.log(`temporary password: ${staff.temporaryPassword}`);
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
