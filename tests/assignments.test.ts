import assert from "node:assert/strict";

import {
  dueDateFromInput,
  emptyProgress,
  isOverdue,
  matchesAssignmentFilter,
  watchedPercent,
} from "../src/lib/assignment-view";

function main() {
  const first = emptyProgress();
  const second = emptyProgress();
  first.watchedRanges.push([0, 5]);
  assert.equal(second.watchedRanges.length, 0);
  assert.equal(second.watchedSeconds, 0);
  assert.equal(second.videoCompleted, false);

  assert.equal(watchedPercent(0, 100), 0);
  assert.equal(watchedPercent(98, 100), 98);
  assert.equal(watchedPercent(150, 100), 100);
  assert.equal(watchedPercent(10, 0), 0);

  const past = new Date("2020-01-01T00:00:00.000Z");
  const future = new Date("2999-01-01T00:00:00.000Z");
  const now = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(isOverdue({ status: "assigned", dueDate: past }, now), true);
  assert.equal(isOverdue({ status: "in_progress", dueDate: past }, now), true);
  assert.equal(isOverdue({ status: "completed", dueDate: past }, now), false);
  assert.equal(isOverdue({ status: "assigned", dueDate: future }, now), false);
  assert.equal(isOverdue({ status: "assigned" }, now), false);

  assert.equal(matchesAssignmentFilter({ status: "completed", dueDate: past }, "open", now), false);
  assert.equal(matchesAssignmentFilter({ status: "assigned", dueDate: past }, "overdue", now), true);
  assert.equal(matchesAssignmentFilter({ status: "completed" }, "completed", now), true);

  const due = dueDateFromInput("2026-11-19");
  assert.equal(due.toISOString(), "2026-11-19T23:59:59.999Z");
  assert.throws(() => dueDateFromInput("2026-02-31"), /valid due date/);
  assert.throws(() => dueDateFromInput("2026-13-01"), /valid due date/);

  console.log("assignment tests passed");
}

main();
