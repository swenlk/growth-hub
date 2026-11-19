"use server";

import { revalidatePath } from "next/cache";

import { connectDB } from "@/lib/db";
import { AuthzError, requireRole, tenantObjectId } from "@/lib/rbac";
import { courseStatusSchema, objectIdSchema } from "@/lib/validators";
import { CourseModel } from "@/models/Course";

export async function setCourseStatusAction(
  _previous: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  let tenantId: string;
  try {
    const session = await requireRole("tenant_admin");
    if (!session.tenantId) {
      return { error: "Your account is not assigned to a tenant" };
    }
    tenantId = session.tenantId;
    await connectDB();
  } catch (error) {
    if (error instanceof AuthzError) return { error: error.message };
    throw error;
  }

  const courseId = objectIdSchema.safeParse(formData.get("courseId"));
  const status = courseStatusSchema.safeParse(formData.get("status"));
  if (!courseId.success || !status.success) {
    return { error: "That course update is not valid" };
  }

  const updated = await CourseModel.updateOne(
    { _id: courseId.data, tenantId: tenantObjectId(tenantId) },
    { $set: { status: status.data } },
  );
  if (updated.matchedCount === 0) {
    return { error: "Course not found" };
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId.data}`);
  revalidatePath("/admin");
  return { error: null };
}
