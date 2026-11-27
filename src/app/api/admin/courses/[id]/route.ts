import { revalidatePath } from "next/cache";

import { courseVideos, type CourseVideoFile } from "@/lib/course-videos";
import { MediaError, removeStoredVideo, writeVideoUpload } from "@/lib/media";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { courseStatusSchema, objectIdSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function orderedVideos(kept: CourseVideoFile[], uploaded: CourseVideoFile[], order: string[]): CourseVideoFile[] {
  if (order.length === 0) return [...kept, ...uploaded];
  const keptByName = new Map(kept.map((video) => [video.storedFileName, video]));
  const usedKeep = new Set<string>();
  const usedNew = new Set<number>();
  const next: CourseVideoFile[] = [];
  for (const token of order) {
    if (token.startsWith("keep:")) {
      const name = token.slice("keep:".length);
      const match = keptByName.get(name);
      if (!match || usedKeep.has(name)) throw new MediaError(400, "That video list is not valid");
      usedKeep.add(name);
      next.push(match);
      continue;
    }
    if (token.startsWith("new:")) {
      const index = Number(token.slice("new:".length));
      const match = uploaded[index];
      if (!Number.isInteger(index) || !match || usedNew.has(index)) {
        throw new MediaError(400, "That video list is not valid");
      }
      usedNew.add(index);
      next.push(match);
      continue;
    }
    throw new MediaError(400, "That video list is not valid");
  }
  if (usedKeep.size !== kept.length || usedNew.size !== uploaded.length) {
    throw new MediaError(400, "That video list is not valid");
  }
  return next;
}

function selectKept(current: CourseVideoFile[], keep: string[]): CourseVideoFile[] {
  const seen = new Set<string>();
  const kept: CourseVideoFile[] = [];
  for (const name of keep) {
    if (seen.has(name)) {
      throw new MediaError(400, "That video list is not valid");
    }
    seen.add(name);
    const match = current.find((item) => item.storedFileName === name);
    if (!match) {
      throw new MediaError(400, "That video list is not valid");
    }
    kept.push(match);
  }
  return kept;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!objectIdSchema.safeParse(id).success) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  let storedNames: string[] = [];
  let mediaDir: string | null = null;

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    mediaDir = ctx.mediaDir;
    const uploaded = await writeVideoUpload(request, { root: ctx.mediaDir, requireFile: false });
    storedNames = uploaded.videos.map((video) => video.storedFileName);
    const status = courseStatusSchema.safeParse(uploaded.status);
    if (!status.success) {
      throw new MediaError(400, "That course update is not valid");
    }

    const existing = await ctx.models.Course.findById(id);
    if (!existing) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    const current = courseVideos(existing);
    const kept = selectKept(current, uploaded.keep);
    const next = orderedVideos(kept, uploaded.videos, uploaded.order);
    if (next.length === 0) {
      throw new MediaError(400, "Add at least one video");
    }

    const nextNames = new Set(next.map((video) => video.storedFileName));
    const removed = current.filter((video) => !nextNames.has(video.storedFileName));
    existing.set({
      title: uploaded.title,
      description: uploaded.description ?? "",
      status: status.data,
      videos: next,
      video: next[0],
    });
    await existing.save();
    storedNames = [];

    await Promise.all(removed.map((video) => removeStoredVideo(video.storedFileName, ctx.mediaDir).catch(() => undefined)));

    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    revalidatePath(`/admin/courses/${id}/edit`);
    revalidatePath("/admin/assignments");
    revalidatePath("/learn");
    revalidatePath("/admin");
    return Response.json({
      id,
      videos: next.map((video) => ({
        storedFileName: video.storedFileName,
        originalFileName: video.originalFileName,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
      })),
    });
  } catch (error) {
    if (mediaDir) {
      await Promise.all(storedNames.map((name) => removeStoredVideo(name, mediaDir!).catch(() => undefined)));
    }
    if (error instanceof AuthzError || error instanceof MediaError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Course update failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
