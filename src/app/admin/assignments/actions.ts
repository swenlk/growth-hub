"use server";

import { revalidatePath } from "next/cache";

import { dueDateFromInput } from "@/lib/assignment-view";
import { assignCourse, AssignmentError } from "@/lib/assignments";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { createAssignmentSchema } from "@/lib/validators";

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
