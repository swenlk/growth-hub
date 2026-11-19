export const ROLES = ["super_admin", "tenant_admin", "staff"] as const;
export type AppRole = (typeof ROLES)[number];

export const TENANT_STATUSES = ["active", "disabled"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const COURSE_STATUSES = ["active", "archived"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const STAFF_STATUSES = ["active", "disabled"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Inclusive-exclusive seconds: [startSec, endSec], merged and sorted. */
export type WatchedRange = [number, number];

export interface AssignmentProgress {
  watchedRanges: WatchedRange[];
  watchedSeconds: number;
  lastPositionSeconds: number;
  videoCompleted: boolean;
  videoCompletedAt?: Date;
  lastHeartbeatAt?: Date;
}
