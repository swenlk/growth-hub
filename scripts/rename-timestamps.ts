/**
 * One-time: store createdDate and updatedDate instead of createdAt and updatedAt.
 *   npx tsx scripts/rename-timestamps.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

import { dbPrefix, platformDbName } from "../src/lib/tenant";

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

async function renameField(collection: mongoose.mongo.Collection, from: string, to: string): Promise<number> {
  const moved = await collection.updateMany(
    { [from]: { $exists: true }, [to]: { $exists: false } },
    { $rename: { [from]: to } },
  );
  const dropped = await collection.updateMany({ [from]: { $exists: true } }, { $unset: { [from]: "" } });
  return moved.modifiedCount + dropped.modifiedCount;
}

function keptDate(primary: string, fallback: string): Record<string, unknown> {
  return {
    $cond: {
      if: { $ne: [{ $ifNull: [primary, fallback] }, null] },
      then: { $ifNull: [primary, fallback] },
      else: "$$REMOVE",
    },
  };
}

async function renameAssignmentDates(collection: mongoose.mongo.Collection): Promise<number> {
  const result = await collection.updateMany(
    {
      $or: [
        { "assignments.assignedAt": { $exists: true } },
        { "assignments.completedAt": { $exists: true } },
        { "assignments.progress.videoCompletedAt": { $exists: true } },
        { "assignments.progress.lastHeartbeatAt": { $exists: true } },
      ],
    },
    [
      {
        $set: {
          assignments: {
            $map: {
              input: { $ifNull: ["$assignments", []] },
              as: "item",
              in: {
                assignmentId: "$$item.assignmentId",
                courseId: "$$item.courseId",
                assignedDate: { $ifNull: ["$$item.assignedDate", "$$item.assignedAt"] },
                assignedBy: "$$item.assignedBy",
                dueDate: keptDate("$$item.dueDate", "$$item.dueDate"),
                status: "$$item.status",
                progress: {
                  watchedRanges: "$$item.progress.watchedRanges",
                  watchedSeconds: "$$item.progress.watchedSeconds",
                  lastPositionSeconds: "$$item.progress.lastPositionSeconds",
                  videoCompleted: "$$item.progress.videoCompleted",
                  videoCompletedDate: keptDate("$$item.progress.videoCompletedDate", "$$item.progress.videoCompletedAt"),
                  lastHeartbeatDate: keptDate("$$item.progress.lastHeartbeatDate", "$$item.progress.lastHeartbeatAt"),
                },
                completedDate: keptDate("$$item.completedDate", "$$item.completedAt"),
              },
            },
          },
        },
      },
    ],
  );
  return result.modifiedCount;
}

async function main() {
  loadEnvFiles();
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not set");
  const prefix = dbPrefix();
  const platform = platformDbName();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const admin = mongoose.connection.db?.admin();
  if (!admin) throw new Error("MongoDB connection is not ready");
  const listed = await admin.listDatabases();

  let changed = 0;
  for (const entry of listed.databases) {
    const name = entry.name;
    if (name === "admin" || name === "local" || name === "config") continue;
    const db = mongoose.connection.useDb(name);
    if (name === platform) {
      changed += await renameField(db.collection("tenants"), "createdAt", "createdDate");
      continue;
    }
    if (!name.startsWith(prefix)) continue;
    changed += await renameField(db.collection("courses"), "createdAt", "createdDate");
    changed += await renameField(db.collection("courses"), "updatedAt", "updatedDate");
    changed += await renameField(db.collection("staff"), "createdAt", "createdDate");
    changed += await renameField(db.collection("staff"), "updatedAt", "updatedDate");
    changed += await renameAssignmentDates(db.collection("staff"));
  }

  console.log(`Renamed timestamp fields on ${changed} record update(s).`);
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Rename failed");
  process.exit(1);
});
