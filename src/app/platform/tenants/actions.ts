"use server";

import { revalidatePath } from "next/cache";

import type { AccountFormState } from "@/lib/form-state";
import { AuthzError, requireRole } from "@/lib/rbac";
import { createTenantWithAdmin, setTenantStatus, TenantSetupError } from "@/lib/tenants";
import { createTenantSchema, updateTenantStatusSchema } from "@/lib/validators";

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
    slug: formData.get("slug"),
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

export async function setTenantStatusAction(
  _previous: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const slug = formData.get("slug");
  const parsed = updateTenantStatusSchema.safeParse({ status: formData.get("status") });
  if (typeof slug !== "string" || !parsed.success) {
    return { error: "That update is not valid" };
  }

  try {
    await requireRole("super_admin");
    await setTenantStatus(slug, parsed.data.status);
  } catch (error) {
    if (error instanceof AuthzError || error instanceof TenantSetupError) return { error: error.message };
    throw error;
  }

  revalidatePath("/platform/tenants");
  return { error: null };
}
