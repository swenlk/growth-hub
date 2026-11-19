import { ROLES, type AppRole } from "@/lib/domain";

const ROLE_ORDER: AppRole[] = ["super_admin", "tenant_admin", "staff"];

export function readRoles(value: unknown): AppRole[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const allowed = new Set<string>(ROLES);
  const found = new Set<AppRole>();

  for (const entry of raw) {
    if (typeof entry === "string" && allowed.has(entry)) {
      found.add(entry as AppRole);
    }
  }

  return ROLE_ORDER.filter((role) => found.has(role));
}

export function readTenantId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const tenantId = raw.trim();
  return tenantId.length > 0 ? tenantId : null;
}

export function primaryRole(roles: AppRole[]): AppRole | null {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? null;
}

export function homeForRoles(roles: AppRole[]): string {
  switch (primaryRole(roles)) {
    case "super_admin":
      return "/platform/tenants";
    case "tenant_admin":
      return "/admin";
    case "staff":
      return "/learn";
    default:
      return "/login";
  }
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health"
  );
}

/** Role gate for pages and API routes. Tenant data is loaded with getTenantContext(). */
export function canAccess(pathname: string, roles: AppRole[]): boolean {
  if (pathname.startsWith("/platform") || pathname.startsWith("/api/platform")) {
    return roles.includes("super_admin");
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return roles.includes("tenant_admin");
  }
  if (pathname.startsWith("/learn") || pathname.startsWith("/api/assignments")) {
    return roles.includes("staff");
  }
  if (pathname.startsWith("/api/media")) {
    return roles.includes("staff") || roles.includes("tenant_admin");
  }
  if (pathname.startsWith("/api")) {
    return roles.length > 0;
  }
  return true;
}
