"use server";

import { revalidatePath } from "next/cache";

import type { AccountFormState } from "@/lib/form-state";
import { connectDB } from "@/lib/db";
import { AuthzError, requireRole } from "@/lib/rbac";
import { createStaffMember, setStaffStatus, StaffDirectoryError } from "@/lib/staff-directory";
import { createStaffSchema, objectIdSchema, staffStatusSchema } from "@/lib/validators";

export async function createStaffAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  let tenantId: string;
  try {
    const session = await requireRole("tenant_admin");
    if (!session.tenantId) {
      return { error: "Your account is not assigned to a tenant", created: null };
    }
    tenantId = session.tenantId;
    await connectDB();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { error: error.message, created: null };
    }
    throw error;
  }

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", created: null };
  }

  try {
    const created = await createStaffMember(tenantId, parsed.data);
    revalidatePath("/admin/staff");
    revalidatePath("/admin");
    return {
      error: null,
      created: { email: created.email, temporaryPassword: created.temporaryPassword },
    };
  } catch (error) {
    if (error instanceof StaffDirectoryError) {
      return { error: error.message, created: null };
    }
    throw error;
  }
}

export async function setStaffStatusAction(
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

  const staffId = objectIdSchema.safeParse(formData.get("staffId"));
  const status = staffStatusSchema.safeParse(formData.get("status"));
  if (!staffId.success || !status.success) {
    return { error: "That staff update is not valid" };
  }

  try {
    await setStaffStatus(tenantId, staffId.data, status.data);
    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${staffId.data}`);
    revalidatePath("/admin");
    return { error: null };
  } catch (error) {
    if (error instanceof StaffDirectoryError) return { error: error.message };
    throw error;
  }
}
