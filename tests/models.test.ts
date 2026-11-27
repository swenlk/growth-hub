import assert from "node:assert/strict";

import { courseSchema } from "../src/models/Course";
import { staffSchema } from "../src/models/Staff";
import { tenantSchema } from "../src/models/Tenant";

function uniqueIndexFields(indexes: ReturnType<typeof staffSchema.indexes>): string[] {
  return indexes
    .filter(([, options]) => Boolean(options.unique))
    .map(([fields]) => Object.keys(fields).sort().join("+"))
    .sort();
}

function main() {
  assert.equal(courseSchema.path("tenantId"), undefined);
  assert.equal(staffSchema.path("tenantId"), undefined);
  assert.equal(
    courseSchema.indexes().some(([fields]) => "tenantId" in fields),
    false,
  );
  assert.equal(
    staffSchema.indexes().some(([fields]) => "tenantId" in fields),
    false,
  );

  assert.deepEqual(uniqueIndexFields(staffSchema.indexes()), ["email", "keycloakUserId"]);
  assert.ok(staffSchema.path("assignments"));
  assert.equal(staffSchema.path("assignments.assignmentId")?.isRequired, true);

  const slug = tenantSchema.path("tenant");
  assert.equal(slug?.options.immutable, true);
  assert.equal(slug?.options.unique, true);
  assert.deepEqual(tenantSchema.path("status")?.options.enum, ["active", "disabled"]);
  assert.ok(tenantSchema.path("createdDate"));
  assert.equal(tenantSchema.path("updatedAt"), undefined);
  assert.equal(tenantSchema.path("updatedDate"), undefined);
  assert.ok(courseSchema.path("createdDate"));
  assert.ok(courseSchema.path("updatedDate"));
  assert.ok(staffSchema.path("createdDate"));
  assert.ok(staffSchema.path("updatedDate"));

  console.log("model tests passed");
}

main();
