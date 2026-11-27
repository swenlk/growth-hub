"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dueDateFromInput } from "@/lib/assignment-view";
import { assignCourse, AssignmentError, updateAssignment } from "@/lib/assignments";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { createAssignmentSchema, updateAssignmentSchema } from "@/lib/validators";

export type AssignFormState = {
  error: string | null;
  created: number | null;
};

export async function assignCourseAction(
  _previous: AssignFormState,
  formData: FormData,
): Promise<AssignFormState> {
  const dueRaw = formData.get("dueDate");
  const staffIds: string[] = [];
  const seen = new Set<string>();
  for (const value of formData.getAll("staffIds")) {
    if (typeof value !== "string" || seen.has(value)) continue;
    seen.add(value);
    staffIds.push(value);
  }

  const parsed = createAssignmentSchema.safeParse({
    courseId: formData.get("courseId"),
    staffIds,
    dueDate: typeof dueRaw === "string" && dueRaw.trim() !== "" ? dueRaw.trim() : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", created: null };
  }

  if (parsed.data.dueDate) {
    try {
      dueDateFromInput(parsed.data.dueDate);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Use a valid due date", created: null };
    }
  }

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    const created = await assignCourse(ctx, parsed.data);
    revalidatePath("/admin/assignments");
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    revalidatePath(`/admin/courses/${parsed.data.courseId}`);
    for (const staffId of parsed.data.staffIds) {
      revalidatePath(`/admin/staff/${staffId}`);
    }
    return { error: null, created };
  } catch (error) {
    if (error instanceof AuthzError || error instanceof AssignmentError) {
      return { error: error.message, created: null };
    }
    throw error;
  }
}

export type AssignmentEditState = { error: string | null; saved: boolean };

export async function updateAssignmentAction(
  _previous: AssignmentEditState,
  formData: FormData,
): Promise<AssignmentEditState> {
  const assignmentId = z.string().uuid().safeParse(formData.get("assignmentId"));
  const dueRaw = formData.get("dueDate");
  const parsed = updateAssignmentSchema.safeParse({
    staffId: formData.get("staffId"),
    courseId: formData.get("courseId"),
    dueDate: typeof dueRaw === "string" && dueRaw.trim() !== "" ? dueRaw.trim() : undefined,
    status: formData.get("status"),
  });
  if (!assignmentId.success || !parsed.success) {
    return {
      error: parsed.success ? "That assignment update is not valid" : (parsed.error.issues[0]?.message ?? "Check the form"),
      saved: false,
    };
  }

  try {
    const dueDate = parsed.data.dueDate ? dueDateFromInput(parsed.data.dueDate) : null;
    await requireRole("tenant_admin");
    const { models } = await getTenantContext();
    const updated = await updateAssignment(models, assignmentId.data, {
      staffId: parsed.data.staffId,
      courseId: parsed.data.courseId,
      dueDate,
      status: parsed.data.status,
    });
    revalidatePath("/admin/assignments");
    revalidatePath(`/admin/assignments/${assignmentId.data}/edit`);
    revalidatePath(`/admin/courses/${updated.courseId}`);
    revalidatePath(`/admin/courses/${updated.previousCourseId}`);
    revalidatePath(`/admin/staff/${updated.staffId}`);
    revalidatePath(`/admin/staff/${updated.previousStaffId}`);
    revalidatePath("/admin/reports");
    revalidatePath("/learn");
    revalidatePath("/admin");
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof AuthzError || error instanceof AssignmentError) {
      return { error: error.message, saved: false };
    }
    if (error instanceof Error && error.message === "Use a valid due date") {
      return { error: error.message, saved: false };
    }
    throw error;
  }
}
