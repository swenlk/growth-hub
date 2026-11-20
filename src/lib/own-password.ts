import "server-only";

import { KeycloakAdminError, setAccountPassword } from "@/lib/keycloak-admin";
import type { TenantContext } from "@/lib/rbac";

export class OwnPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnPasswordError";
  }
}

/** Change the signed-in staff member's password. The lookup is their own Keycloak id. */
export async function changeOwnPassword(ctx: TenantContext, input: { newPassword: string }) {
  const staff = await ctx.models.Staff.findOne({ keycloakUserId: ctx.session.sub });
  if (!staff) {
    throw new OwnPasswordError("Your profile is not in this organization");
  }
  if (staff.status !== "active" || staff.keycloakUserId.startsWith("pending:")) {
    throw new OwnPasswordError("This account cannot change its password");
  }

  try {
    await setAccountPassword(staff.keycloakUserId, input.newPassword);
  } catch (error) {
    if (error instanceof KeycloakAdminError) {
      throw new OwnPasswordError(error.message);
    }
    throw error;
  }
}
