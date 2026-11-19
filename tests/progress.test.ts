import assert from "node:assert/strict";

import { emptyProgress } from "../src/lib/assignment-view";
import {
  VIDEO_COMPLETE_RATIO,
  applyHeartbeat,
  applyHeartbeatToAssignment,
  completeAssignment,
  continuousSpan,
  mergeRanges,
  sumRanges,
  type AssignmentWatch,
} from "../src/lib/progress";

function at(iso: string): Date {
  return new Date(iso);
}

function watch(id: string, status: AssignmentWatch["status"] = "assigned"): AssignmentWatch {
  return { assignmentId: id, status, progress: emptyProgress() };
}

function main() {
  const input: [number, number][] = [
    [0, 5],
    [4, 8],
    [8, 10],
    [20, 22],
  ];
  const merged = mergeRanges(input);
  assert.deepEqual(merged, [
    [0, 10],
    [20, 22],
  ]);
  assert.deepEqual(input[0], [0, 5]);
  assert.equal(sumRanges([[0, 5], [20, 25]]), 10);

  const played = continuousSpan(0, 4, 4);
  assert.deepEqual(played, { from: 0, to: 4 });
  assert.equal(continuousSpan(0, 50, 0.2), null);
  const afterSeek = [continuousSpan(10, 13, 3)].filter((span) => span !== null);
  assert.deepEqual(
    mergeRanges(afterSeek.map((span) => [span.from, span.to])),
    [[10, 13]],
  );

  const spoofed = emptyProgress();
  const spoofAt = at("2026-01-01T00:00:01.000Z");
  spoofed.lastHeartbeatAt = at("2026-01-01T00:00:00.000Z");
  assert.throws(
    () => applyHeartbeat(spoofed, "in_progress", { from: 0, to: 40, position: 40 }, 120, spoofAt),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 400,
  );
  assert.equal(spoofed.watchedSeconds, 0);
  assert.equal(spoofed.watchedRanges.length, 0);

  const started = emptyProgress();
  started.lastHeartbeatAt = at("2026-01-01T00:00:00.000Z");
  const almost = applyHeartbeat(
    started,
    "assigned",
    { from: 0, to: 97, position: 97 },
    100,
    at("2026-01-01T00:02:00.000Z"),
  );
  assert.equal(almost.progress.videoCompleted, false);
  assert.equal(almost.status, "in_progress");
  assert.equal(VIDEO_COMPLETE_RATIO, 0.98);

  const done = applyHeartbeat(
    almost.progress,
    almost.status,
    { from: 97, to: 98, position: 98 },
    100,
    at("2026-01-01T00:02:02.000Z"),
  );
  assert.equal(done.progress.videoCompleted, true);
  assert.equal(done.status, "in_progress");
  assert.ok(done.progress.videoCompletedAt);

  const fileEndsEarly = emptyProgress();
  fileEndsEarly.lastHeartbeatAt = at("2026-01-01T00:00:00.000Z");
  const shortFile = applyHeartbeat(
    fileEndsEarly,
    "in_progress",
    { from: 0, to: 40.6, position: 40.6 },
    42,
    at("2026-01-01T00:02:00.000Z"),
  );
  assert.equal(shortFile.progress.videoCompleted, true);
  assert.equal(shortFile.progress.watchedSeconds, 42);
  assert.equal(shortFile.status, "in_progress");

  const nearEnd = emptyProgress();
  nearEnd.lastHeartbeatAt = at("2026-01-01T00:00:00.000Z");
  const roundedPastEnd = applyHeartbeat(
    nearEnd,
    "in_progress",
    { from: 40, to: 42.2, position: 42.2 },
    42,
    at("2026-01-01T00:00:04.000Z"),
  );
  assert.equal(roundedPastEnd.progress.watchedSeconds, 2);
  assert.equal(roundedPastEnd.progress.lastPositionSeconds, 42);
  assert.equal(roundedPastEnd.progress.videoCompleted, false);

  const wayPast = emptyProgress();
  wayPast.lastHeartbeatAt = at("2026-01-01T00:00:00.000Z");
  assert.throws(
    () => applyHeartbeat(wayPast, "in_progress", { from: 40, to: 50, position: 50 }, 42, at("2026-01-01T00:00:05.000Z")),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 400,
  );
  assert.equal(wayPast.watchedSeconds, 0);

  assert.throws(
    () => completeAssignment({ assignmentId: "a", status: "in_progress", progress: almost.progress }, at("2026-01-01T00:03:00.000Z")),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 409,
  );
  const completed = completeAssignment(
    { assignmentId: "a", status: done.status, progress: done.progress },
    at("2026-01-01T00:03:00.000Z"),
  );
  assert.equal(completed.status, "completed");
  const again = completeAssignment(completed, at("2026-01-01T00:04:00.000Z"));
  assert.equal(again.status, "completed");
  assert.equal(again.completedAt?.toISOString(), completed.completedAt?.toISOString());

  const first = watch("one");
  const second = watch("two");
  const updated = applyHeartbeatToAssignment(
    [first, second],
    "one",
    { from: 0, to: 5, position: 5 },
    100,
    at("2026-01-01T00:00:05.000Z"),
  );
  assert.equal(updated[0]?.progress.watchedSeconds, 5);
  assert.equal(updated[1]?.progress.watchedSeconds, 0);
  assert.equal(updated[1]?.status, "assigned");
  assert.equal(first.progress.watchedSeconds, 0);

  console.log("progress tests passed");
}

main();
