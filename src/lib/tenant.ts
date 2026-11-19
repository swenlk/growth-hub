import path from "node:path";

import type { AppRole } from "@/lib/domain";

/**
 * Tenant slugs are immutable after creation.
 * Database names and media paths are built only from a slug that has passed
 * assertValidSlug. Callers must not rename a tenant or trust a slug from a request.
 */

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 30;

const DEFAULT_PLATFORM_DB = "growth_hub";
const DEFAULT_DB_PREFIX = "growth_hub_";
const RESERVED = new Set(["platform", "admin", "system", "local", "config"]);
const SAFE_PREFIX = /^[A-Za-z0-9_-]+$/;
const UNSAFE_DB_NAME = /[/\\."$\u0000]/;

export const RESERVED_SLUGS: ReadonlySet<string> = RESERVED;

export class TenantSlugError extends Error {
  constructor(message = "Tenant slug is not valid") {
    super(message);
    this.name = "TenantSlugError";
  }
}

function configuredPrefix(): string {
  const raw = process.env.TENANT_DB_PREFIX;
  if (typeof raw !== "string" || raw.trim() === "") return DEFAULT_DB_PREFIX;
  return raw.trim();
}

function assertSafePrefix(prefix: string): string {
  if (!SAFE_PREFIX.test(prefix)) {
    throw new Error("TENANT_DB_PREFIX must contain only letters, numbers, hyphens, and underscores");
  }
  return prefix;
}

function assertSafeDbName(name: string): string {
  if (name.length === 0 || name.length >= 64 || UNSAFE_DB_NAME.test(name)) {
    throw new Error("Tenant database name is not allowed");
  }
  return name;
}

/** Prefix for tenant databases, as in growth_hub_<slug>. Read on each call. */
export function dbPrefix(): string {
  return assertSafePrefix(configuredPrefix());
}

export const DB_PREFIX = dbPrefix();

/** Control database. Holds the tenant registry. */
export function platformDbName(): string {
  return assertSafeDbName(DEFAULT_PLATFORM_DB);
}

export const PLATFORM_DB = platformDbName();

/**
 * Accept only a lowercase slug. This does not trim or lowercase.
 * Uppercase, dots, slashes, and reserved words are rejected.
 */
export function assertValidSlug(slug: string): string {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > SLUG_MAX || !SLUG_REGEX.test(slug)) {
    throw new TenantSlugError("Tenant slug is not valid");
  }
  if (RESERVED.has(slug)) {
    throw new TenantSlugError("Tenant slug is reserved");
  }
  return slug;
}

/**
 * Keycloak tenantId is the tenant slug.
 * super_admin has no tenant. Other roles must pass assertValidSlug.
 */
export function tenantAttributeValue(role: AppRole, tenantId: string | null): string | null {
  if (role === "super_admin") {
    if (tenantId !== null) {
      throw new TenantSlugError("super_admin has no tenant");
    }
    return null;
  }
  if (tenantId === null) {
    throw new TenantSlugError("tenantId is required for this role");
  }
  return assertValidSlug(tenantId);
}

export function tenantDbName(slug: string): string {
  const safe = assertValidSlug(slug);
  return assertSafeDbName(`${dbPrefix()}${safe}`);
}

function mediaDir(): string {
  const configured = process.env.MEDIA_DIR?.trim();
  return path.resolve(configured && configured.length > 0 ? configured : path.join(process.cwd(), "media"));
}

function staysInside(root: string, full: string): boolean {
  const relative = path.relative(root, full);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    !relative.includes(path.sep) &&
    !relative.includes("/")
  );
}

/** Directory for one tenant's videos. The resolved path must stay inside MEDIA_DIR. */
export function tenantMediaDir(slug: string): string {
  const safe = assertValidSlug(slug);
  const root = mediaDir();
  const full = path.resolve(path.join(root, safe));
  if (!staysInside(root, full)) {
    throw new TenantSlugError("Invalid tenant media path");
  }
  return full;
}
