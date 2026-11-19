import "server-only";

import { mkdir, rm, stat } from "node:fs/promises";

import { dropTenantDatabase, getPlatformModels, provisionTenantDatabase } from "@/lib/db";
import type { TenantStatus } from "@/lib/domain";
import { createUser, deleteUser, KeycloakAdminError } from "@/lib/keycloak-admin";
import { temporaryPassword } from "@/lib/passwords";
import { forgetTenantRegistry } from "@/lib/tenant-registry";
import { assertValidSlug, TenantSlugError, tenantMediaDir } from "@/lib/tenant";
import {
  createTenantSchema,
  updateTenantStatusSchema,
  type CreateTenantInput,
} from "@/lib/validators";

export class TenantSetupError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TenantSetupError";
    this.status = status;
  }
}

function duplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const info = await stat(dir);
    return info.isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Registry row, then the tenant database, then the media folder, then the Keycloak admin.
 * tenantId on that admin is the slug. Any failure removes the steps that completed, in reverse.
 */
export async function createTenantWithAdmin(input: CreateTenantInput): Promise<{
  name: string;
  slug: string;
  email: string;
  temporaryPassword: string;
}> {
  const parsed = createTenantSchema.parse(input);
  let slug: string;
  try {
    slug = assertValidSlug(parsed.slug);
  } catch (error) {
    if (error instanceof TenantSlugError) {
      throw new TenantSetupError("That slug is not valid");
    }
    throw error;
  }

  const { Tenant } = await getPlatformModels();
  const existing = await Tenant.exists({ slug });
  if (existing) {
    throw new TenantSetupError("That slug is already used", 409);
  }

  const password = temporaryPassword();
  let registryId: string | null = null;
  let databaseReady = false;
  let createdMedia = false;
  let keycloakUserId: string | null = null;

  try {
    const tenant = await Tenant.create({
      name: parsed.name,
      slug,
      status: "active",
    });
    registryId = tenant._id.toString();

    databaseReady = true;
    await provisionTenantDatabase(slug);

    const mediaDir = tenantMediaDir(slug);
    if (!(await directoryExists(mediaDir))) {
      await mkdir(mediaDir, { recursive: true });
      createdMedia = true;
    }

    keycloakUserId = await createUser({
      name: parsed.adminName,
      email: parsed.adminEmail,
      tenantId: slug,
      role: "tenant_admin",
      temporaryPassword: password,
    });

    forgetTenantRegistry(slug);
    return {
      name: tenant.name,
      slug,
      email: parsed.adminEmail,
      temporaryPassword: password,
    };
  } catch (error) {
    await rollbackTenantCreate({
      slug,
      registryId,
      databaseReady,
      createdMedia,
      keycloakUserId,
    });
    if (duplicateKey(error)) {
      throw new TenantSetupError("That slug is already used", 409);
    }
    if (error instanceof KeycloakAdminError && error.status === 409) {
      throw new TenantSetupError("That email is already used", 409);
    }
    if (error instanceof KeycloakAdminError) {
      throw new TenantSetupError(error.message);
    }
    if (error instanceof TenantSetupError) throw error;
    console.error("Tenant create failed", error instanceof Error ? error.name : "Error");
    throw new TenantSetupError("The organization could not be created");
  }
}

export async function setTenantStatus(slug: string, status: TenantStatus): Promise<void> {
  const parsed = updateTenantStatusSchema.parse({ status });
  let safe: string;
  try {
    safe = assertValidSlug(slug);
  } catch (error) {
    if (error instanceof TenantSlugError) {
      throw new TenantSetupError("That slug is not valid");
    }
    throw error;
  }

  const { Tenant } = await getPlatformModels();
  const updated = await Tenant.updateOne({ slug: safe }, { $set: { status: parsed.status } });
  if (updated.matchedCount === 0) {
    throw new TenantSetupError("Organization was not found", 404);
  }
  forgetTenantRegistry(safe);
}

async function rollbackTenantCreate(done: {
  slug: string;
  registryId: string | null;
  databaseReady: boolean;
  createdMedia: boolean;
  keycloakUserId: string | null;
}): Promise<void> {
  if (done.keycloakUserId) {
    await deleteUser(done.keycloakUserId).catch((error: unknown) => {
      console.error("Tenant cleanup could not delete the Keycloak user", error instanceof Error ? error.name : "Error");
    });
  }
  if (done.createdMedia) {
    await rm(tenantMediaDir(done.slug), { recursive: true, force: true }).catch((error: unknown) => {
      console.error("Tenant cleanup could not remove the media folder", error instanceof Error ? error.name : "Error");
    });
  }
  if (done.databaseReady) {
    await dropTenantDatabase(done.slug).catch((error: unknown) => {
      console.error("Tenant cleanup could not drop the database", error instanceof Error ? error.name : "Error");
    });
  }
  if (done.registryId) {
    const { Tenant } = await getPlatformModels();
    await Tenant.deleteOne({ _id: done.registryId }).catch((error: unknown) => {
      console.error("Tenant cleanup could not delete the registry row", error instanceof Error ? error.name : "Error");
    });
  }
  forgetTenantRegistry(done.slug);
}
