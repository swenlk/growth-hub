import "server-only";

import mongoose, { type Connection, type Model, type Schema } from "mongoose";
import { z } from "zod";

import { courseSchema, type Course } from "@/models/Course";
import { staffSchema, type Staff } from "@/models/Staff";
import { tenantSchema, type Tenant } from "@/models/Tenant";
import { platformDbName, tenantDbName } from "@/lib/tenant";

const mongoEnvSchema = z.object({
  MONGODB_URI: z.string().trim().min(1),
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

function mongoUri(): string {
  const parsed = mongoEnvSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
  });
  if (!parsed.success) {
    throw new Error("MONGODB_URI is not set");
  }
  return parsed.data.MONGODB_URI;
}

function modelFor<T>(connection: Connection, name: string, schema: Schema<T>, collection: string): Model<T> {
  const existing = connection.models[name] as Model<T> | undefined;
  if (existing) return existing;
  return connection.model<T>(name, schema, collection);
}

/**
 * One socket per server process. Hot reload reuses it through globalThis.
 * Tenant data is not stored on this connection's default database.
 * Call getPlatformDb or getTenantDb, which select a database by name.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 5000 }).catch((error: unknown) => {
      cache.promise = null;
      throw error;
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/** Control database. The Tenant registry model is registered on the returned connection. */
export async function getPlatformDb(): Promise<Connection> {
  const base = await connectDB();
  const db = base.connection.useDb(platformDbName(), { useCache: true });
  modelFor(db, "Tenant", tenantSchema, "tenants");
  return db;
}

export async function getPlatformModels(): Promise<{ Tenant: Model<Tenant> }> {
  const db = await getPlatformDb();
  return { Tenant: modelFor(db, "Tenant", tenantSchema, "tenants") };
}

/**
 * Dedicated database for one tenant. The slug is validated before the name is built.
 * Request handlers must go through getTenantContext(). This is for provisioning and other
 * explicit platform work.
 */
export async function getTenantDb(slug: string): Promise<Connection> {
  const base = await connectDB();
  return base.connection.useDb(tenantDbName(slug), { useCache: true });
}

export async function getTenantModels(slug: string): Promise<{ Course: Model<Course>; Staff: Model<Staff> }> {
  const db = await getTenantDb(slug);
  return {
    Course: modelFor(db, "Course", courseSchema, "courses"),
    Staff: modelFor(db, "Staff", staffSchema, "staff"),
  };
}

/** Create the tenant collections and indexes. Mongo creates the database on the first write. */
export async function provisionTenantDatabase(slug: string): Promise<void> {
  const { Course, Staff } = await getTenantModels(slug);
  await Course.createCollection();
  await Course.syncIndexes();
  await Staff.createCollection();
  await Staff.syncIndexes();
}

/** Drop one tenant database. The slug is validated before the name is used. */
export async function dropTenantDatabase(slug: string): Promise<void> {
  const db = await getTenantDb(slug);
  await db.dropDatabase();
}
