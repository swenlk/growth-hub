import { connectDB } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = await connectDB();
    const collections = await connection.connection.db?.listCollections().toArray();

    return Response.json({
      ok: true,
      database: connection.connection.db?.databaseName ?? "training_platform",
      collections: (collections ?? []).map((collection) => collection.name).sort(),
    });
  } catch (error) {
    console.error("MongoDB health check failed", error instanceof Error ? error.name : "Error");
    return Response.json({ ok: false, error: "Database unavailable" }, { status: 503 });
  }
}
