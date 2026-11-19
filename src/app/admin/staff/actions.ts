"use server";

import { revalidatePath } from "next/cache";

import type { AccountFormState } from "@/lib/form-state";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { createStaffMember, setStaffStatus, StaffDirectoryError } from "@/lib/staff-directory";
import { createStaffSchema, objectIdSchema, staffStatusSchema } from "@/lib/validators";

export async function createStaffAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", created: null };
  }

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    const created = await createStaffMember(ctx, parsed.data);
    revalidatePath("/admin/staff");
    revalidatePath("/admin");
    return {
      error: null,
      created: { email: created.email, temporaryPassword: created.temporaryPassword },
    };
  } catch (error) {
    if (error instanceof AuthzError || error instanceof StaffDirectoryError) {
      return { error: error.message, created: null };
    }
    throw error;
  }
}

export async function setStaffStatusAction(
  _previous: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const staffId = objectIdSchema.safeParse(formData.get("staffId"));
  const status = staffStatusSchema.safeParse(formData.get("status"));
  if (!staffId.success || !status.success) {
    return { error: "That staff update is not valid" };
  }

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    await setStaffStatus(ctx, staffId.data, status.data);
  } catch (error) {
    if (error instanceof AuthzError || error instanceof StaffDirectoryError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId.data}`);
  revalidatePath("/admin");
  return { error: null };
}
