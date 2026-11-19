import { stat } from "node:fs/promises";

import { connectDB } from "@/lib/db";
import { fileRangeResponse, MediaError, mediaRoot, resolveStoredFile } from "@/lib/media";
import { AuthzError, requireTenant, tenantObjectId } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";
import { CourseModel } from "@/models/Course";
import { StaffModel } from "@/models/Staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function streamCourse(request: Request, courseId: string) {
  if (!objectIdSchema.safeParse(courseId).success) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // tenantId comes from the session. Staff also need an assignment for this course.
  const { session, tenantId } = await requireTenant();
  await connectDB();
  const tenant = tenantObjectId(tenantId);
  const course = await CourseModel.findOne({ _id: courseId, tenantId: tenant }).lean();
  if (!course) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const staffOnly = session.roles.includes("staff") && !session.roles.includes("tenant_admin");
  if (staffOnly) {
    const assigned = await StaffModel.exists({
      tenantId: tenant,
      keycloakUserId: session.sub,
      "assignments.courseId": course._id,
    });
    if (!assigned) {
      return Response.json({ error: "You are not assigned this course" }, { status: 403 });
    }
  }

  let filePath: string;
  try {
    filePath = resolveStoredFile(mediaRoot(), course.video.storedFileName);
    await stat(filePath);
  } catch (error) {
    if (error instanceof MediaError) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    console.error("Course video missing", courseId);
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return fileRangeResponse(
    request,
    filePath,
    course.video.mimeType,
    course.video.originalFileName,
  );
}

export async function GET(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await context.params;
    return await streamCourse(request, courseId);
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Media stream failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Video could not be streamed" }, { status: 500 });
  }
}

export async function HEAD(request: Request, context: { params: Promise<{ courseId: string }> }) {
  return GET(request, context);
}
