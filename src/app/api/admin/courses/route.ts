import { MediaError, removeStoredVideo, writeVideoUpload } from "@/lib/media";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  let storedNames: string[] = [];
  let mediaDir: string | null = null;

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    mediaDir = ctx.mediaDir;
    const uploaded = await writeVideoUpload(request, { root: ctx.mediaDir });
    storedNames = uploaded.videos.map((video) => video.storedFileName);
    const first = uploaded.videos[0];
    if (!first) {
      throw new MediaError(400, "Add at least one video");
    }

    const course = await ctx.models.Course.create({
      title: uploaded.title,
      description: uploaded.description,
      status: "active",
      video: first,
      videos: uploaded.videos,
    });

    storedNames = [];
    return Response.json({ id: course._id.toString() }, { status: 201 });
  } catch (error) {
    if (mediaDir) {
      await Promise.all(storedNames.map((name) => removeStoredVideo(name, mediaDir!).catch(() => undefined)));
    }
    if (error instanceof AuthzError || error instanceof MediaError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Course upload failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
