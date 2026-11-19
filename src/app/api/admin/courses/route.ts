import { MediaError, removeStoredVideo, writeVideoUpload } from "@/lib/media";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  let storedName: string | null = null;
  let mediaDir: string | null = null;

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    mediaDir = ctx.mediaDir;
    const uploaded = await writeVideoUpload(request, { root: ctx.mediaDir });
    storedName = uploaded.storedFileName;

    const course = await ctx.models.Course.create({
      title: uploaded.title,
      description: uploaded.description,
      status: "active",
      video: {
        storedFileName: uploaded.storedFileName,
        originalFileName: uploaded.originalFileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        durationSeconds: uploaded.durationSeconds,
      },
    });

    storedName = null;
    return Response.json({ id: course._id.toString() }, { status: 201 });
  } catch (error) {
    if (storedName && mediaDir) {
      await removeStoredVideo(storedName, mediaDir).catch(() => undefined);
    }
    if (error instanceof AuthzError || error instanceof MediaError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Course upload failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
