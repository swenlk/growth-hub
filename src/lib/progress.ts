import type { AssignmentProgress, AssignmentStatus, WatchedRange } from "@/lib/domain";

/** Watched time must cover this share of the video before it can be marked complete. */
export const VIDEO_COMPLETE_RATIO = 0.98;

/** A continuous span may run this much faster than the wall clock. */
export const PLAYBACK_RATE_LIMIT = 1.5;

/** Extra seconds allowed on top of the wall-clock window. */
export const HEARTBEAT_SLACK_SECONDS = 2;

/**
 * A file's real length and the stored length can disagree by about a second.
 * A range that lands inside this gap is kept, instead of being rejected.
 */
const END_SLACK_SECONDS = 1.5;

/** Heartbeats are sent about this often, so the first one has no earlier timestamp. */
export const HEARTBEAT_INTERVAL_SECONDS = 5;

export const MAX_PLAYBACK_RATE = 2;

export class ProgressError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "ProgressError";
    this.status = status;
  }
}

export type Heartbeat = {
  from: number;
  to: number;
  position: number;
};

export type AssignmentWatch = {
  assignmentId: string;
  status: AssignmentStatus;
  progress: AssignmentProgress;
  completedAt?: Date;
};

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function copyRanges(ranges: WatchedRange[]): WatchedRange[] {
  return ranges.map(([start, end]) => [start, end]);
}

/** Merge overlapping and adjacent intervals. Does not fill a gap left by a seek. */
export function mergeRanges(ranges: WatchedRange[]): WatchedRange[] {
  const sorted = ranges
    .filter((range) => range.length >= 2 && Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[1] > range[0])
    .map(([start, end]) => [roundSeconds(start), roundSeconds(end)] as WatchedRange)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const merged: WatchedRange[] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (!last || start > last[1]) {
      merged.push([start, end]);
    } else if (end > last[1]) {
      last[1] = end;
    }
  }
  return merged;
}

export function sumRanges(ranges: WatchedRange[]): number {
  return roundSeconds(mergeRanges(ranges).reduce((total, [start, end]) => total + (end - start), 0));
}

/**
 * A playback sample counts only when the media clock moved no faster than
 * 1.5× the real time since the previous sample. A seek returns null.
 */
export function continuousSpan(
  from: number,
  to: number,
  elapsedSeconds: number,
): { from: number; to: number } | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return null;
  const allowed = Math.max(0, elapsedSeconds) * PLAYBACK_RATE_LIMIT + 0.35;
  if (to - from > allowed) return null;
  return { from: roundSeconds(from), to: roundSeconds(to) };
}

export function allowedWatchSeconds(lastHeartbeatAt: Date | undefined, now: Date): number {
  if (!lastHeartbeatAt) {
    return HEARTBEAT_INTERVAL_SECONDS * PLAYBACK_RATE_LIMIT + HEARTBEAT_SLACK_SECONDS;
  }
  const elapsed = Math.max(0, (now.getTime() - lastHeartbeatAt.getTime()) / 1000);
  return elapsed * PLAYBACK_RATE_LIMIT + HEARTBEAT_SLACK_SECONDS;
}

function cloneProgress(progress: AssignmentProgress): AssignmentProgress {
  return {
    watchedRanges: copyRanges(progress.watchedRanges),
    watchedSeconds: progress.watchedSeconds,
    lastPositionSeconds: progress.lastPositionSeconds,
    videoCompleted: progress.videoCompleted,
    videoCompletedAt: progress.videoCompletedAt,
    lastHeartbeatAt: progress.lastHeartbeatAt,
  };
}

/**
 * Merge one continuous range into progress.
 * An oversized range is rejected and the previous progress is left unchanged.
 * Crossing 98% sets videoCompleted and leaves status at in_progress.
 */
export function applyHeartbeat(
  progress: AssignmentProgress,
  status: AssignmentStatus,
  heartbeat: Heartbeat,
  durationSeconds: number,
  now: Date,
): { progress: AssignmentProgress; status: AssignmentStatus } {
  if (status === "completed") {
    return { progress: cloneProgress(progress), status };
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new ProgressError(400, "This video has no duration");
  }

  let from = roundSeconds(heartbeat.from);
  let to = roundSeconds(heartbeat.to);
  let position = roundSeconds(heartbeat.position);
  if (to > durationSeconds && to - durationSeconds <= END_SLACK_SECONDS) to = durationSeconds;
  if (position > durationSeconds && position - durationSeconds <= END_SLACK_SECONDS) {
    position = durationSeconds;
  }
  if (!(from >= 0 && to > from && to <= durationSeconds)) {
    throw new ProgressError(400, "That watch range is outside the video");
  }
  if (!(position >= 0 && position <= durationSeconds)) {
    throw new ProgressError(400, "That position is outside the video");
  }

  const allowed = allowedWatchSeconds(progress.lastHeartbeatAt, now);
  if (to - from > allowed + 0.001) {
    throw new ProgressError(400, "That watch range is too long for the time since the last update");
  }

  // The player can finish the file slightly before the stored duration.
  if (durationSeconds - to <= END_SLACK_SECONDS && position + 0.25 >= to) {
    const coveredEnd = progress.watchedRanges.reduce((end, range) => Math.max(end, range[1]), 0);
    if (from - coveredEnd > 0 && from - coveredEnd <= END_SLACK_SECONDS) from = coveredEnd;
    to = durationSeconds;
    position = durationSeconds;
  }

  const watchedRanges = mergeRanges([...progress.watchedRanges, [from, to]]);
  const watchedSeconds = sumRanges(watchedRanges);
  const reached = watchedSeconds + 0.001 >= durationSeconds * VIDEO_COMPLETE_RATIO;
  const next: AssignmentProgress = {
    watchedRanges,
    watchedSeconds,
    lastPositionSeconds: position,
    videoCompleted: progress.videoCompleted || reached,
    videoCompletedAt: progress.videoCompletedAt ?? (reached ? now : undefined),
    lastHeartbeatAt: now,
  };

  return {
    progress: next,
    status: status === "assigned" ? "in_progress" : status,
  };
}

export function completeAssignment(
  input: AssignmentWatch,
  now: Date,
): AssignmentWatch {
  if (input.status === "completed") {
    return {
      ...input,
      progress: cloneProgress(input.progress),
      completedAt: input.completedAt ?? now,
    };
  }
  if (!input.progress.videoCompleted) {
    throw new ProgressError(409, "Watch the video before marking it complete");
  }
  return {
    ...input,
    progress: cloneProgress(input.progress),
    status: "completed",
    completedAt: now,
  };
}

/** Update one assignment id. A second assignment of the same course is left untouched. */
export function applyHeartbeatToAssignment(
  items: AssignmentWatch[],
  assignmentId: string,
  heartbeat: Heartbeat,
  durationSeconds: number,
  now: Date,
): AssignmentWatch[] {
  return items.map((item) => {
    if (item.assignmentId !== assignmentId) return item;
    const next = applyHeartbeat(item.progress, item.status, heartbeat, durationSeconds, now);
    return { ...item, ...next };
  });
}
