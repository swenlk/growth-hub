import { SLUG_MAX, assertValidSlug } from "@/lib/tenant";

export type MigrationCounts = {
  courses: number;
  staff: number;
  assignments: number;
  files: number;
};

export type SlugChoice = {
  slug: string;
  source: "map" | "stored" | "name";
};

/** Lowercase a display name into a tenant slug. */
export function slugFromName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const sliced = base.slice(0, SLUG_MAX).replace(/-+$/g, "");
  return assertValidSlug(sliced);
}

/**
 * Map file wins. A stored slug is kept when it is already valid.
 * Otherwise the slug is derived from the organization name.
 */
export function chooseSlug(input: {
  name: string;
  storedSlug?: string | null;
  mapped?: string | null;
}): SlugChoice {
  if (input.mapped) {
    return { slug: assertValidSlug(input.mapped), source: "map" };
  }
  if (input.storedSlug) {
    try {
      return { slug: assertValidSlug(input.storedSlug), source: "stored" };
    } catch {
      // The stored slug is not usable. Fall through to the name.
    }
  }
  return { slug: slugFromName(input.name), source: "name" };
}

/** Lines are `oldId=slug` or `oldId slug`. Blank lines and # comments are ignored. */
export function parseTenantMap(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    const pieces = eq === -1 ? line.split(/\s+/) : [line.slice(0, eq), line.slice(eq + 1)];
    const id = (pieces[0] ?? "").trim().toLowerCase();
    const slug = assertValidSlug((pieces[1] ?? "").trim());
    if (!/^[a-f\d]{24}$/.test(id)) {
      throw new Error(`Map key ${id} is not a tenant id`);
    }
    const previous = map.get(id);
    if (previous && previous !== slug) {
      throw new Error(`Map key ${id} is listed twice`);
    }
    map.set(id, slug);
  }
  return map;
}

export function countAssignments(staff: Array<{ assignments?: unknown }>): number {
  return staff.reduce((sum, person) => {
    return sum + (Array.isArray(person.assignments) ? person.assignments.length : 0);
  }, 0);
}

export function countsMatch(before: MigrationCounts, after: MigrationCounts): boolean {
  return (
    before.courses === after.courses &&
    before.staff === after.staff &&
    before.assignments === after.assignments &&
    before.files === after.files
  );
}

export function collidingSlugs(slugs: string[]): string[] {
  const seen = new Map<string, number>();
  for (const slug of slugs) {
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
}

export function sourceDatabaseName(input: {
  explicit?: string;
  databaseEnv?: string;
  uri?: string;
}): string {
  const explicit = input.explicit?.trim();
  if (explicit) return explicit;
  const fromEnv = input.databaseEnv?.trim();
  if (fromEnv) return fromEnv;
  const uri = input.uri?.trim() ?? "";
  try {
    const name = decodeURIComponent(new URL(uri).pathname.replace(/^\//, "").split("/")[0] ?? "");
    if (name) return name;
  } catch {
    return "training_platform";
  }
  return "training_platform";
}

/** The shared database from before database-per-tenant. Never a platform or tenant database. */
export function assertMigrationSource(name: string, platform: string, prefix: string): string {
  if (!name || /[/\\."$\s]/.test(name) || name === platform || name.startsWith(prefix)) {
    throw new Error(`Refusing to use ${name || "(empty)"} as the old shared database`);
  }
  return name;
}
