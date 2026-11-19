"use server";

import { revalidatePath } from "next/cache";

import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { courseStatusSchema, objectIdSchema } from "@/lib/validators";

export async function setCourseStatusAction(
  _previous: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const courseId = objectIdSchema.safeParse(formData.get("courseId"));
  const status = courseStatusSchema.safeParse(formData.get("status"));
  if (!courseId.success || !status.success) {
    return { error: "That course update is not valid" };
  }

  try {
    await requireRole("tenant_admin");
    const { models } = await getTenantContext();
    const updated = await models.Course.updateOne({ _id: courseId.data }, { $set: { status: status.data } });
    if (updated.matchedCount === 0) {
      return { error: "Course not found" };
    }
  } catch (error) {
    if (error instanceof AuthzError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId.data}`);
  revalidatePath("/admin");
  return { error: null };
}
