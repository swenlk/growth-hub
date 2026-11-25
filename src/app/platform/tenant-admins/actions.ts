"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import type { AccountFormState } from "@/lib/form-state";
import { KeycloakAdminError, updateTenantAdminAccount } from "@/lib/keycloak-admin";
import { AuthzError, requireRole } from "@/lib/rbac";
import { TenantSlugError } from "@/lib/tenant";
import { createTenantAdmin, TenantSetupError } from "@/lib/tenants";
import { createTenantAdminSchema, updateTenantAdminSchema } from "@/lib/validators";

export type TenantAdminEditState = { error: string | null; saved: boolean };

export async function updateTenantAdminAction(
  _previous: TenantAdminEditState,
  formData: FormData,
): Promise<TenantAdminEditState> {
  const parsed = updateTenantAdminSchema.safeParse({
    name: formData.get("name"),
    status: formData.get("status"),
  });
  const userId = formData.get("userId");
  const tenant = formData.get("tenant");
  if (!parsed.success || typeof userId !== "string" || typeof tenant !== "string") {
    return { error: parsed.success ? "That update is not valid" : (parsed.error.issues[0]?.message ?? "Check the form"), saved: false };
  }

  try {
    await requireRole("super_admin");
    await updateTenantAdminAccount(userId, tenant, {
      name: parsed.data.name,
      enabled: parsed.data.status === "active",
    });
  } catch (error) {
    if (error instanceof AuthzError || error instanceof KeycloakAdminError || error instanceof TenantSlugError) {
      return { error: error.message, saved: false };
    }
    if (error instanceof ZodError) {
      return { error: "That update is not valid", saved: false };
    }
    throw error;
  }

  revalidatePath("/platform/tenant-admins");
  revalidatePath(`/platform/tenants/${tenant}`);
  return { error: null, saved: true };
}

export async function addTenantAdminAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = createTenantAdminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  const tenant = formData.get("tenant");
  if (!parsed.success || typeof tenant !== "string" || tenant.length === 0) {
    return {
      error: parsed.success ? "Select an organization" : (parsed.error.issues[0]?.message ?? "Check the form"),
      created: null,
    };
  }

  try {
    await requireRole("super_admin");
    const created = await createTenantAdmin(tenant, parsed.data);
    revalidatePath(`/platform/tenants/${tenant}`);
    return { error: null, created: { email: created.email, temporaryPassword: created.temporaryPassword } };
  } catch (error) {
    if (error instanceof AuthzError || error instanceof TenantSetupError || error instanceof TenantSlugError) {
      return { error: error.message, created: null };
    }
    if (error instanceof KeycloakAdminError || error instanceof ZodError) {
      return { error: error instanceof ZodError ? "That admin is not valid" : error.message, created: null };
    }
    throw error;
  }
}
