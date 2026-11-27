import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createTenantSchema } from "../src/lib/validators";
import {
  SLUG_MAX,
  TenantSlugError,
  assertValidSlug,
  dbPrefix,
  platformDbName,
  tenantAttributeValue,
  tenantDbName,
  tenantMediaDir,
} from "../src/lib/tenant";

function withEnv(name: string, value: string | undefined, run: () => void) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

function rejects(slug: string) {
  assert.throws(() => assertValidSlug(slug), TenantSlugError);
  assert.throws(() => tenantDbName(slug), TenantSlugError);
  assert.throws(() => tenantMediaDir(slug), TenantSlugError);
}

async function main() {
  withEnv("MONGODB_DATABASE", "growth_hub", () => {
    withEnv("TENANT_DB_PREFIX", undefined, () => {
      assert.equal(platformDbName(), "growth_hub");
      assert.equal(dbPrefix(), "growth_hub_");
      assert.equal(assertValidSlug("abc"), "abc");
      assert.equal(tenantDbName("abc"), "growth_hub_abc");
      assert.equal(tenantDbName("acme-west-2"), "growth_hub_acme-west-2");
      assert.equal(assertValidSlug("a".repeat(SLUG_MAX)), "a".repeat(SLUG_MAX));
      assert.equal(tenantDbName("a".repeat(SLUG_MAX)).length < 64, true);
    });
    withEnv("TENANT_DB_PREFIX", "custom_", () => {
      assert.equal(platformDbName(), "growth_hub");
      assert.equal(dbPrefix(), "custom_");
      assert.equal(tenantDbName("abc"), "custom_abc");
    });
  });

  withEnv("MONGODB_DATABASE", undefined, () => {
    withEnv("TENANT_DB_PREFIX", undefined, () => {
      assert.throws(() => platformDbName(), /MONGODB_DATABASE is not set/);
      assert.throws(() => dbPrefix(), /MONGODB_DATABASE is not set/);
    });
  });
  withEnv("MONGODB_DATABASE", "not a name", () => {
    assert.throws(() => platformDbName(), /MONGODB_DATABASE/);
  });
  withEnv("MONGODB_DATABASE", "acme", () => {
    withEnv("TENANT_DB_PREFIX", undefined, () => {
      assert.equal(platformDbName(), "acme");
      assert.equal(tenantDbName("abc"), "acme_abc");
    });
  });

  for (const slug of [
    "abc",
    "a",
    "a1",
    "acme-west-2",
    "a".repeat(SLUG_MAX),
  ]) {
    assert.equal(assertValidSlug(slug), slug);
  }

  withEnv("MONGODB_DATABASE", "growth_hub", () => {
    for (const slug of [
    "../x",
    "..",
    ".",
    "..\\x",
    "a/b",
    "a\\b",
    "a.b",
    "A",
    "Abc",
    "ABC",
    "a--b",
    "-abc",
    "abc-",
    "a_b",
    "a b",
    "a$b",
    'a"b',
    "",
    " ",
    "a".repeat(31),
    "a".repeat(64),
    "platform",
    "admin",
    "system",
    "local",
    "config",
    "a\u0000b",
    ]) {
      rejects(slug);
    }

    withEnv("MONGODB_DATABASE", "growth_hub", () => {
    withEnv("TENANT_DB_PREFIX", "../", () => {
      assert.throws(() => dbPrefix(), /TENANT_DB_PREFIX/);
      assert.throws(() => tenantDbName("abc"), /TENANT_DB_PREFIX/);
      assert.equal(platformDbName(), "growth_hub");
    });
  });
    withEnv("TENANT_DB_PREFIX", "growth.hub-", () => {
      assert.throws(() => tenantDbName("abc"), /TENANT_DB_PREFIX/);
    });
    withEnv("TENANT_DB_PREFIX", "x".repeat(40), () => {
      assert.throws(() => tenantDbName("a".repeat(SLUG_MAX)), /Tenant database name/);
      assert.equal(tenantDbName("abc"), `${"x".repeat(40)}abc`);
    });
  });

  const root = await mkdtemp(path.join(tmpdir(), "tenant-media-"));
  withEnv("MEDIA_DIR", root, () => {
    const dir = tenantMediaDir("abc");
    assert.equal(dir, path.resolve(root, "abc"));
    const relative = path.relative(path.resolve(root), dir);
    assert.equal(relative, "abc");
    assert.equal(relative.startsWith(".."), false);
  });
  withEnv("MEDIA_DIR", path.join(root, "nested") + path.sep, () => {
    assert.equal(tenantMediaDir("acme-2"), path.resolve(root, "nested", "acme-2"));
  });

  const created = createTenantSchema.parse({
    name: "Acme",
    tenant: " Acme-West ",
    adminName: "Ada",
    adminEmail: "ada@example.com",
  });
  assert.equal(created.tenant, "acme-west");

  assert.equal(tenantAttributeValue("super_admin", null), null);
  assert.equal(tenantAttributeValue("tenant_admin", "abc"), "abc");
  assert.equal(tenantAttributeValue("staff", "acme-west"), "acme-west");
  assert.throws(() => tenantAttributeValue("super_admin", "abc"), TenantSlugError);
  assert.throws(() => tenantAttributeValue("tenant_admin", null), TenantSlugError);
  assert.throws(() => tenantAttributeValue("staff", "ABC"), TenantSlugError);
  assert.throws(() => tenantAttributeValue("staff", "../x"), TenantSlugError);

  for (const slug of ["../x", "A".repeat(31), "platform", "a.b"]) {
    const parsed = createTenantSchema.safeParse({
      name: "Acme",
      tenant: slug,
      adminName: "Ada",
      adminEmail: "ada@example.com",
    });
    assert.equal(parsed.success, false);
  }

  console.log("tenant tests passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
