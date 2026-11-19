import { connectDB } from "@/lib/db";
import { MediaError, removeStoredVideo, writeVideoUpload } from "@/lib/media";
import { AuthzError, requireRole, tenantObjectId } from "@/lib/rbac";
import { CourseModel } from "@/models/Course";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  let storedName: string | null = null;

  try {
    const session = await requireRole("tenant_admin");
    if (!session.tenantId) {
      return Response.json({ error: "Your account is not assigned to a tenant" }, { status: 403 });
    }

    await connectDB();
    const uploaded = await writeVideoUpload(request);
    storedName = uploaded.storedFileName;

    const course = await CourseModel.create({
      tenantId: tenantObjectId(session.tenantId),
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
    if (storedName) {
      await removeStoredVideo(storedName).catch(() => undefined);
    }
    if (error instanceof AuthzError || error instanceof MediaError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Course upload failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
