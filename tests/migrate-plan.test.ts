import assert from "node:assert/strict";

import {
  assertMigrationSource,
  chooseSlug,
  collidingSlugs,
  countAssignments,
  countsMatch,
  parseTenantMap,
  slugFromName,
  sourceDatabaseName,
} from "../src/lib/migrate-plan";
import { TenantSlugError } from "../src/lib/tenant";

function main() {
  assert.equal(slugFromName("Abc Training"), "abc-training");
  assert.equal(slugFromName("Hello!!!"), "hello");
  assert.throws(() => slugFromName("Platform"), TenantSlugError);
  assert.throws(() => slugFromName("---"), TenantSlugError);

  assert.deepEqual(chooseSlug({ name: "Abc Training", storedSlug: "abc" }), {
    slug: "abc",
    source: "stored",
  });
  assert.deepEqual(chooseSlug({ name: "Abc Training", storedSlug: "ABC", mapped: "abc" }), {
    slug: "abc",
    source: "map",
  });
  assert.deepEqual(chooseSlug({ name: "Abc Training", storedSlug: "Not A Slug" }), {
    slug: "abc-training",
    source: "name",
  });

  const mapped = parseTenantMap(`
    # sample
    507f1f77bcf86cd799439011=abc
    507F1F77BCF86CD799439012 xyz
  `);
  assert.equal(mapped.get("507f1f77bcf86cd799439011"), "abc");
  assert.equal(mapped.get("507f1f77bcf86cd799439012"), "xyz");
  assert.throws(() => parseTenantMap("not-an-id=abc"), /tenant id/);
  assert.throws(() => parseTenantMap("507f1f77bcf86cd799439011=../x"), TenantSlugError);

  assert.equal(countAssignments([{ assignments: [{}, {}] }, { assignments: [] }, {}]), 2);
  assert.equal(
    countsMatch(
      { courses: 1, staff: 1, assignments: 2, files: 1 },
      { courses: 1, staff: 1, assignments: 2, files: 1 },
    ),
    true,
  );
  assert.equal(
    countsMatch(
      { courses: 1, staff: 1, assignments: 2, files: 1 },
      { courses: 1, staff: 2, assignments: 2, files: 1 },
    ),
    false,
  );
  assert.deepEqual(collidingSlugs(["abc", "xyz", "abc"]), ["abc"]);

  assert.equal(
    sourceDatabaseName({ uri: "mongodb://localhost:27017/training_platform" }),
    "training_platform",
  );
  assert.equal(
    sourceDatabaseName({ databaseEnv: "legacy", uri: "mongodb://localhost:27017/training_platform" }),
    "legacy",
  );
  assert.equal(assertMigrationSource("training_platform", "growth_hub", "growth_hub_"), "training_platform");
  assert.throws(() => assertMigrationSource("growth_hub", "growth_hub", "growth_hub_"), /Refusing/);
  assert.throws(() => assertMigrationSource("growth_hub_abc", "growth_hub", "growth_hub_"), /Refusing/);

  console.log("migrate plan tests passed");
}

main();
