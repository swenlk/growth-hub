"use server";

import { revalidatePath } from "next/cache";

import type { AccountFormState } from "@/lib/form-state";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { createStaffMember, StaffDirectoryError, updateStaffMember } from "@/lib/staff-directory";
import { createStaffSchema, objectIdSchema, updateStaffSchema } from "@/lib/validators";

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

export type StaffEditState = { error: string | null; saved: boolean };

export async function updateStaffAction(
  _previous: StaffEditState,
  formData: FormData,
): Promise<StaffEditState> {
  const staffId = objectIdSchema.safeParse(formData.get("staffId"));
  const parsed = updateStaffSchema.safeParse({
    name: formData.get("name"),
    status: formData.get("status"),
  });
  if (!staffId.success || !parsed.success) {
    return { error: parsed.success ? "That staff update is not valid" : (parsed.error.issues[0]?.message ?? "Check the form"), saved: false };
  }

  try {
    await requireRole("tenant_admin");
    const ctx = await getTenantContext();
    await updateStaffMember(ctx, staffId.data, parsed.data);
  } catch (error) {
    if (error instanceof AuthzError || error instanceof StaffDirectoryError) {
      return { error: error.message, saved: false };
    }
    throw error;
  }

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId.data}`);
  revalidatePath(`/admin/staff/${staffId.data}/edit`);
  revalidatePath("/admin");
  return { error: null, saved: true };
}
