export function readText(value: string | string[] | undefined, max = 120) {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return raw.slice(0, max);
}

export function readPage(value: string | string[] | undefined) {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(raw) && raw > 1 ? raw : 0;
}

export function readChoice<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  return allowed.includes(raw as T) ? (raw as T) : "";
}

export function readObjectId(value: string | string[] | undefined) {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return /^[a-f\d]{24}$/i.test(raw) ? raw : "";
}

export function withListQuery(path: string, entries: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === "" || value === 0) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
