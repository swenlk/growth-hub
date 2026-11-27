"use server";

import { changeOwnPassword, OwnPasswordError } from "@/lib/own-password";
import { AuthzError, getTenantContext, requireRole } from "@/lib/rbac";
import { changeOwnPasswordSchema } from "@/lib/validators";

export type ProfilePasswordState = { error: string | null; saved: boolean };

export async function changeOwnPasswordAction(
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
    await requireRole("staff");
    const ctx = await getTenantContext();
    await changeOwnPassword(ctx, parsed.data);
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof AuthzError || error instanceof OwnPasswordError) {
      return { error: error.message, saved: false };
    }
    throw error;
  }
}
