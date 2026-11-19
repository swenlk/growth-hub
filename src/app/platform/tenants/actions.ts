"use server";

import { revalidatePath } from "next/cache";

import type { AccountFormState } from "@/lib/form-state";
import { connectDB } from "@/lib/db";
import { AuthzError, requireRole } from "@/lib/rbac";
import { createTenantWithAdmin, TenantSetupError } from "@/lib/tenants";
import { createTenantSchema } from "@/lib/validators";

export async function createTenantAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  try {
    await requireRole("super_admin");
    await connectDB();
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
