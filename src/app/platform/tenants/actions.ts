"use server";

import { revalidatePath } from "next/cache";

import type { AccountFormState } from "@/lib/form-state";
import { AuthzError, requireRole } from "@/lib/rbac";
import { createTenantWithAdmin, TenantSetupError, updateTenant } from "@/lib/tenants";
import { createTenantSchema, updateTenantSchema } from "@/lib/validators";

export async function createTenantAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  try {
    await requireRole("super_admin");
  } catch (error) {
    if (error instanceof AuthzError) {
      return { error: error.message, created: null };
    }
    throw error;
  }

  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    tenant: formData.get("tenant"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", created: null };
  }

  try {
    const created = await createTenantWithAdmin(parsed.data);
    revalidatePath("/platform/tenants");
    return {
      error: null,
      created: { email: created.email, temporaryPassword: created.temporaryPassword },
    };
  } catch (error) {
    if (error instanceof TenantSetupError) {
      return { error: error.message, created: null };
    }
    throw error;
  }
}

export type TenantEditState = { error: string | null; saved: boolean };

export async function updateTenantAction(
  _previous: TenantEditState,
  formData: FormData,
): Promise<TenantEditState> {
  const tenant = formData.get("tenant");
  const parsed = updateTenantSchema.safeParse({
    name: formData.get("name"),
    status: formData.get("status"),
  });
  if (typeof tenant !== "string" || !parsed.success) {
    return {
      error: parsed.success ? "That update is not valid" : (parsed.error.issues[0]?.message ?? "Check the form"),
      saved: false,
    };
  }

  try {
    await requireRole("super_admin");
    await updateTenant(tenant, parsed.data);
  } catch (error) {
    if (error instanceof AuthzError || error instanceof TenantSetupError) {
      return { error: error.message, saved: false };
    }
    throw error;
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${tenant}`);
  revalidatePath(`/platform/tenants/${tenant}/edit`);
  return { error: null, saved: true };
}
