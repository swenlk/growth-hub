import { Types } from "mongoose";

import { auth } from "@/lib/auth";
import type { AppRole } from "@/lib/domain";

export class AuthzError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireRole(...allowed: AppRole[]) {
  const session = await auth();
  if (!session?.sub || session.roles.length === 0) {
    throw new AuthzError(401, "Sign in required");
  }
  if (!session.roles.some((role) => allowed.includes(role))) {
    throw new AuthzError(403, "Forbidden");
  }
  return session;
}

/**
 * Tenant id comes only from the Keycloak session.
 * Callers must not accept a tenant id from the request.
 * super_admin is not a member of a tenant; use requireRole("super_admin") instead.
 */
export async function requireTenant() {
  const session = await requireRole("tenant_admin", "staff");
  if (!session.tenantId) {
    throw new AuthzError(403, "Your account is not assigned to a tenant");
  }
  return { session, tenantId: session.tenantId };
}

/** Session tenant id is the Mongo id string written onto the Keycloak user. */
export function tenantObjectId(tenantId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(tenantId) || String(new Types.ObjectId(tenantId)) !== tenantId) {
    throw new AuthzError(403, "Your account is not assigned to a tenant");
  }
  return new Types.ObjectId(tenantId);
}
