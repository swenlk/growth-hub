import type { AssignmentProgress, AssignmentStatus } from "@/lib/domain";

export type AssignmentFilter = "all" | "completed" | "open" | "overdue";

export function emptyProgress(): AssignmentProgress {
  return {
    watchedRanges: [],
    watchedSeconds: 0,
    lastPositionSeconds: 0,
    videoCompleted: false,
  };
}

/** Watched percent uses the summed ranges, capped at the video length. */
export function watchedPercent(watchedSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(watchedSeconds) || watchedSeconds <= 0) return 0;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100));
}

export function isOverdue(
  assignment: { status: AssignmentStatus; dueDate?: Date | null },
  now = new Date(),
): boolean {
  if (assignment.status === "completed" || !assignment.dueDate) return false;
  return assignment.dueDate.getTime() < now.getTime();
}

export function matchesAssignmentFilter(
  assignment: { status: AssignmentStatus; dueDate?: Date | null },
  filter: AssignmentFilter,
  now = new Date(),
): boolean {
  if (filter === "completed") return assignment.status === "completed";
  if (filter === "open") return assignment.status !== "completed";
  if (filter === "overdue") return isOverdue(assignment, now);
  return true;
}

export function readAssignmentFilter(value: string | string[] | undefined): AssignmentFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "completed" || raw === "open" || raw === "overdue") return raw;
  return "all";
}

/**
 * The date input is a calendar day. Store the end of that UTC day so the
 * displayed date matches the value the admin picked.
 */
export function dueDateFromInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Use a valid due date");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Use a valid due date");
  }
  return date;
}

export function formatDay(value: Date | undefined | null): string {
  if (!value) return "-";
  return value.toISOString().slice(0, 10);
}

export function assignmentStatusLabel(status: AssignmentStatus): string {
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return "Not started";
}
