import { getPlatformDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const platform = await getPlatformDb();
    const collections = await platform.db?.listCollections().toArray();

    return Response.json({
      ok: true,
      database: platform.name,
      collections: (collections ?? []).map((collection) => collection.name).sort(),
    });
  } catch (error) {
    console.error("MongoDB health check failed", error instanceof Error ? error.name : "Error");
    return Response.json({ ok: false, error: "Database unavailable" }, { status: 503 });
  }
}
