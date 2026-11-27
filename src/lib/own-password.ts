import "server-only";

import { KeycloakAdminError, readSignInAccount, setAccountPassword } from "@/lib/keycloak-admin";
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

/** Change the signed-in person's password. The id is their own Keycloak user. */
export async function changeOwnAccountPassword(userId: string, input: { newPassword: string }) {
  if (!userId) {
    throw new OwnPasswordError("Sign in required");
  }

  let account: { enabled: boolean };
  try {
    account = await readSignInAccount(userId);
  } catch (error) {
    if (error instanceof KeycloakAdminError) {
      throw new OwnPasswordError(error.status === 404 ? "Your profile was not found" : error.message);
    }
    throw error;
  }
  if (!account.enabled) {
    throw new OwnPasswordError("This account cannot change its password");
  }

  try {
    await setAccountPassword(userId, input.newPassword);
  } catch (error) {
    if (error instanceof KeycloakAdminError) {
      throw new OwnPasswordError(error.message);
    }
    throw error;
  }
}
