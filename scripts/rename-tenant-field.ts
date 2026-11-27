/**
 * One-time: store the organization id as `tenant` instead of `slug`.
 *   npx tsx scripts/rename-tenant-field.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

import { platformDbName } from "../src/lib/tenant";

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
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFiles();
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const coll = mongoose.connection.useDb(platformDbName()).collection("tenants");
  const renamed = await coll.updateMany(
    { slug: { $exists: true }, tenant: { $exists: false } },
    { $rename: { slug: "tenant" } },
  );

  const indexes = await coll.indexes();
  for (const index of indexes) {
    if (index.name && index.name !== "_id_" && index.key && "slug" in index.key) {
      await coll.dropIndex(index.name);
    }
  }
  await coll.createIndex({ tenant: 1 }, { unique: true });

  const count = await coll.countDocuments({ tenant: { $type: "string" } });
  console.log(`Renamed ${renamed.modifiedCount} organization record(s). ${count} now store tenant.`);
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Rename failed");
  process.exit(1);
});
