import "server-only";

import mongoose from "mongoose";
import { z } from "zod";

import { CourseModel } from "@/models/Course";
import { StaffModel } from "@/models/Staff";
import { TenantModel } from "@/models/Tenant";

const DEFAULT_DB_NAME = "training_platform";

const mongoEnvSchema = z.object({
  MONGODB_URI: z.string().trim().min(1),
  MONGODB_DATABASE: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __trainingMongoose?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.__trainingMongoose ?? {
  conn: null,
  promise: null,
};

globalForMongoose.__trainingMongoose = cache;

function databaseFromUri(uri: string): string | undefined {
  try {
    const name = new URL(uri).pathname.replace(/^\//, "").split("/")[0];
    return name || undefined;
  } catch {
    return undefined;
  }
}

function mongoSettings(): { uri: string; dbName: string } {
  const parsed = mongoEnvSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DATABASE: process.env.MONGODB_DATABASE,
  });

  if (!parsed.success) {
    throw new Error("MONGODB_URI is not set");
  }

  const dbName =
    parsed.data.MONGODB_DATABASE ??
    databaseFromUri(parsed.data.MONGODB_URI) ??
    DEFAULT_DB_NAME;

  return { uri: parsed.data.MONGODB_URI, dbName };
}

/**
 * Reuse one connection across hot reloads in `next dev`.
 * Every tenant-owned query must still filter on session.tenantId.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const { uri, dbName } = mongoSettings();
    cache.promise = mongoose
      .connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 5000,
      })
      .then(async (connection) => {
        await Promise.all([
          TenantModel.createIndexes(),
          CourseModel.createIndexes(),
          StaffModel.createIndexes(),
        ]);
        return connection;
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
