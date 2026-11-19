import { revalidatePath } from "next/cache";

import { MediaError, removeStoredVideo, writeVideoUpload } from "@/lib/media";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { courseStatusSchema, objectIdSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!objectIdSchema.safeParse(id).success) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  let storedName: string | null = null;
  let mediaDir: string | null = null;

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    mediaDir = ctx.mediaDir;
    const uploaded = await writeVideoUpload(request, { root: ctx.mediaDir });
    storedName = uploaded.storedFileName;
    const status = courseStatusSchema.safeParse(uploaded.status);
    if (!status.success) {
      throw new MediaError(400, "That course update is not valid");
    }

    const existing = await ctx.models.Course.findById(id);
    if (!existing) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    const previousFile = existing.video.storedFileName;
    existing.title = uploaded.title;
    existing.description = uploaded.description ?? "";
    existing.status = status.data;
    existing.video = {
      storedFileName: uploaded.storedFileName,
      originalFileName: uploaded.originalFileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      durationSeconds: uploaded.durationSeconds,
    };
    await existing.save();
    storedName = null;

    if (previousFile !== uploaded.storedFileName) {
      await removeStoredVideo(previousFile, ctx.mediaDir).catch(() => undefined);
    }

    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    revalidatePath(`/admin/courses/${id}/edit`);
    revalidatePath("/admin/assignments");
    revalidatePath("/learn");
    revalidatePath("/admin");
    return Response.json({ id });
  } catch (error) {
    if (storedName && mediaDir) {
      await removeStoredVideo(storedName, mediaDir).catch(() => undefined);
    }
    if (error instanceof AuthzError || error instanceof MediaError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Course update failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
