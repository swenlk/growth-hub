import "server-only";

import { TenantModel } from "@/models/Tenant";
import { createUser, KeycloakAdminError } from "@/lib/keycloak-admin";
import { temporaryPassword } from "@/lib/passwords";
import { createTenantSchema, type CreateTenantInput } from "@/lib/validators";

export class TenantSetupError extends Error {}

function duplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

/**
 * Create the organization, then its first tenant admin in Keycloak.
 * The Keycloak tenantId attribute is this tenant's Mongo id, which is the only
 * tenant id later stored on the session. If Keycloak fails, the tenant row is removed.
 */
export async function createTenantWithAdmin(input: CreateTenantInput): Promise<{
  name: string;
  email: string;
  temporaryPassword: string;
}> {
  const parsed = createTenantSchema.parse(input);
  let tenant;

  try {
    tenant = await TenantModel.create({
      name: parsed.name,
      slug: parsed.slug,
      status: "active",
    });
  } catch (error) {
    if (duplicateKey(error)) {
      throw new TenantSetupError("That slug is already used");
    }
    throw error;
  }

  const password = temporaryPassword();

  try {
    await createUser({
      name: parsed.adminName,
      email: parsed.adminEmail,
      tenantId: tenant._id.toString(),
      role: "tenant_admin",
      temporaryPassword: password,
    });
  } catch (error) {
    await TenantModel.deleteOne({ _id: tenant._id });
    if (error instanceof KeycloakAdminError && error.status === 409) {
      throw new TenantSetupError("That email is already used");
    }
    if (error instanceof KeycloakAdminError) {
      throw new TenantSetupError(error.message);
    }
    throw error;
  }

  return {
    name: tenant.name,
    email: parsed.adminEmail,
    temporaryPassword: password,
  };
}
