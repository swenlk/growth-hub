import "server-only";

import type { Model } from "mongoose";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { getTenantModels } from "@/lib/db";
import type { AppRole } from "@/lib/domain";
import type { Course } from "@/models/Course";
import type { Staff } from "@/models/Staff";
import { assertValidSlug, TenantSlugError, tenantMediaDir } from "@/lib/tenant";
import { registryStatus } from "@/lib/tenant-registry";

export class AuthzError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export type TenantModels = {
  Course: Model<Course>;
  Staff: Model<Staff>;
};

export type TenantContext = {
  slug: string;
  session: Session;
  models: TenantModels;
  mediaDir: string;
};

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
 * Tenant comes only from the signed-in user.
 * super_admin has no tenant context and must use the platform database.
 * A missing or disabled registry row is rejected. Status changes clear that slug's cache;
 * a lookup that is not cleared expires after about 60 seconds.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const session = await requireRole("tenant_admin", "staff");
  if (!session.tenantId) {
    throw new AuthzError(403, "Your account is not assigned to a tenant");
  }

  let slug: string;
  try {
    slug = assertValidSlug(session.tenantId);
  } catch (error) {
    if (error instanceof TenantSlugError) {
      throw new AuthzError(403, "Your account is not assigned to a tenant");
    }
    throw error;
  }

  const status = await registryStatus(slug);
  if (status === "disabled") {
    throw new AuthzError(403, "This organization is disabled");
  }
  if (status !== "active") {
    throw new AuthzError(403, "Your account is not assigned to a tenant");
  }

  return {
    slug,
    session,
    models: await getTenantModels(slug),
    mediaDir: tenantMediaDir(slug),
  };
}
