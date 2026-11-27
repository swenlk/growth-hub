"use server";

import { changeOwnAccountPassword, OwnPasswordError } from "@/lib/own-password";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { changeOwnPasswordSchema } from "@/lib/validators";

import type { ProfilePasswordState } from "@/app/learn/profile/actions";

export async function changeAdminPasswordAction(
  _previous: ProfilePasswordState,
  formData: FormData,
): Promise<ProfilePasswordState> {
  const parsed = changeOwnPasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", saved: false };
  }

  try {
    const session = await requireRole("tenant_admin");
    await getTenantContext();
    await changeOwnAccountPassword(session.sub, parsed.data);
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof AuthzError || error instanceof OwnPasswordError) {
      return { error: error.message, saved: false };
    }
    throw error;
  }
}
