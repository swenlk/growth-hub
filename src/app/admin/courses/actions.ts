"use server";

import { revalidatePath } from "next/cache";

import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { courseStatusSchema, objectIdSchema, updateCourseSchema } from "@/lib/validators";

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
  revalidatePath(`/admin/courses/${courseId.data}/edit`);
  revalidatePath("/admin");
  return { error: null };
}

export type CourseEditState = { error: string | null; saved: boolean };

export async function updateCourseAction(
  _previous: CourseEditState,
  formData: FormData,
): Promise<CourseEditState> {
  const courseId = objectIdSchema.safeParse(formData.get("courseId"));
  const parsed = updateCourseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
  });
  if (!courseId.success || !parsed.success) {
    return {
      error: parsed.success ? "That course update is not valid" : (parsed.error.issues[0]?.message ?? "Check the form"),
      saved: false,
    };
  }

  try {
    await requireRole("tenant_admin");
    const { models } = await getTenantContext();
    const updated = await models.Course.updateOne(
      { _id: courseId.data },
      { $set: { title: parsed.data.title, description: parsed.data.description, status: parsed.data.status } },
    );
    if (updated.matchedCount === 0) {
      return { error: "Course not found", saved: false };
    }
  } catch (error) {
    if (error instanceof AuthzError) return { error: error.message, saved: false };
    throw error;
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId.data}`);
  revalidatePath(`/admin/courses/${courseId.data}/edit`);
  revalidatePath("/admin/assignments");
  revalidatePath("/admin");
  return { error: null, saved: true };
}
