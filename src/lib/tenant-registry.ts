import "server-only";

import { getPlatformModels } from "@/lib/db";

const REGISTRY_TTL_MS = 60_000;

export type RegistryStatus = "active" | "disabled" | "missing";

type RegistryHit = {
  status: RegistryStatus;
  expiresAt: number;
};

const globalForRegistry = globalThis as typeof globalThis & {
  __growthHubTenantRegistry?: Map<string, RegistryHit>;
};

function registryCache(): Map<string, RegistryHit> {
  const existing = globalForRegistry.__growthHubTenantRegistry;
  if (existing) return existing;
  const created = new Map<string, RegistryHit>();
  globalForRegistry.__growthHubTenantRegistry = created;
  return created;
}

/** Drop one cached registry lookup so the next request reads the new status. */
export function forgetTenantRegistry(slug: string): void {
  registryCache().delete(slug);
}

export async function registryStatus(slug: string): Promise<RegistryStatus> {
  const cache = registryCache();
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > now) return cached.status;

  const { Tenant } = await getPlatformModels();
  const row = await Tenant.findOne({ slug }).select({ status: 1 }).lean();
  const status: RegistryStatus = row == null ? "missing" : row.status === "active" ? "active" : "disabled";
  cache.set(slug, { status, expiresAt: now + REGISTRY_TTL_MS });
  return status;
}
