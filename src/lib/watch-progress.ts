import "server-only";

import { ZodError } from "zod";

import { emptyProgress, watchedPercent } from "@/lib/assignment-view";
import type { AssignmentStatus } from "@/lib/domain";
import {
  applyHeartbeat,
  completeAssignment,
  ProgressError,
  type Heartbeat,
} from "@/lib/progress";
import { AuthzError, type TenantContext } from "@/lib/rbac";
import type { Assignment } from "@/models/Staff";

export function watchErrorResponse(error: unknown): Response {
  if (error instanceof ProgressError || error instanceof AuthzError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json({ error: error instanceof ZodError ? (error.issues[0]?.message ?? "Check the playback update") : "Check the playback update" }, { status: 400 });
  }
  console.error("Watch progress failed", error instanceof Error ? error.name : "Error");
  return Response.json({ error: "Progress could not be saved" }, { status: 500 });
}

export type WatchView = {
  assignmentId: string;
  courseId: string;
  title: string;
  durationSeconds: number;
  status: AssignmentStatus;
  dueDate: string | null;
  completedAt: string | null;
  progress: {
    watchedSeconds: number;
    watchedPercent: number;
    lastPositionSeconds: number;
    videoCompleted: boolean;
    watchedRanges: [number, number][];
  };
};

function viewOf(
  assignment: Assignment,
  course: { _id: { toString(): string }; title: string; video: { durationSeconds: number } },
): WatchView {
  const watchedSeconds = assignment.progress?.watchedSeconds ?? 0;
  const durationSeconds = course.video.durationSeconds;
  return {
    assignmentId: assignment.assignmentId,
    courseId: course._id.toString(),
    title: course.title,
    durationSeconds,
    status: assignment.status,
    dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
    completedAt: assignment.completedAt ? assignment.completedAt.toISOString() : null,
    progress: {
      watchedSeconds,
      watchedPercent: watchedPercent(watchedSeconds, durationSeconds),
      lastPositionSeconds: assignment.progress?.lastPositionSeconds ?? 0,
      videoCompleted: assignment.progress?.videoCompleted ?? false,
      watchedRanges: (assignment.progress?.watchedRanges ?? []).map(
        (range) => [range[0], range[1]] as [number, number],
      ),
    },
  };
}

async function ownedAssignment(ctx: TenantContext, assignmentId: string) {
  const staff = await ctx.models.Staff.findOne({ keycloakUserId: ctx.session.sub }).lean();
  if (!staff) {
    throw new ProgressError(404, "Assignment not found");
  }
  const assignment = staff.assignments.find((item) => item.assignmentId === assignmentId);
  if (!assignment) {
    throw new ProgressError(404, "Assignment not found");
  }
  const course = await ctx.models.Course.findById(assignment.courseId).lean();
  if (!course) {
    throw new ProgressError(404, "Assignment not found");
  }
  return { staffId: staff._id, assignment, course };
}

export async function readAssignment(ctx: TenantContext, assignmentId: string): Promise<WatchView> {
  const { assignment, course } = await ownedAssignment(ctx, assignmentId);
  return viewOf(assignment, course);
}

export async function recordHeartbeat(
  ctx: TenantContext,
  assignmentId: string,
  heartbeat: Heartbeat,
  now = new Date(),
): Promise<WatchView> {
  const { staffId, assignment, course } = await ownedAssignment(ctx, assignmentId);
  const next = applyHeartbeat(
    assignment.progress ?? emptyProgress(),
    assignment.status,
    heartbeat,
    course.video.durationSeconds,
    now,
  );

  if (assignment.status !== "completed") {
    const updated = await ctx.models.Staff.updateOne(
      { _id: staffId, keycloakUserId: ctx.session.sub },
      {
        $set: {
          "assignments.$[item].status": next.status,
          "assignments.$[item].progress.watchedRanges": next.progress.watchedRanges,
          "assignments.$[item].progress.watchedSeconds": next.progress.watchedSeconds,
          "assignments.$[item].progress.lastPositionSeconds": next.progress.lastPositionSeconds,
          "assignments.$[item].progress.videoCompleted": next.progress.videoCompleted,
          "assignments.$[item].progress.lastHeartbeatAt": next.progress.lastHeartbeatAt,
          ...(next.progress.videoCompletedAt
            ? { "assignments.$[item].progress.videoCompletedAt": next.progress.videoCompletedAt }
            : {}),
        },
      },
      { arrayFilters: [{ "item.assignmentId": assignmentId }] },
    );
    if (updated.matchedCount === 0) {
      throw new ProgressError(404, "Assignment not found");
    }
  }

  return viewOf(
    {
      ...assignment,
      status: next.status,
      progress: next.progress,
    },
    course,
  );
}

export async function recordCompletion(
  ctx: TenantContext,
  assignmentId: string,
  now = new Date(),
): Promise<WatchView> {
  const { staffId, assignment, course } = await ownedAssignment(ctx, assignmentId);
  const next = completeAssignment(
    {
      assignmentId: assignment.assignmentId,
      status: assignment.status,
      progress: assignment.progress ?? emptyProgress(),
      completedAt: assignment.completedAt,
    },
    now,
  );

  if (assignment.status !== "completed") {
    const updated = await ctx.models.Staff.updateOne(
      { _id: staffId, keycloakUserId: ctx.session.sub },
      {
        $set: {
          "assignments.$[item].status": "completed",
          "assignments.$[item].completedAt": next.completedAt,
        },
      },
      { arrayFilters: [{ "item.assignmentId": assignmentId }] },
    );
    if (updated.matchedCount === 0) {
      throw new ProgressError(404, "Assignment not found");
    }
  }

  return viewOf(
    {
      ...assignment,
      status: next.status,
      completedAt: next.completedAt,
      progress: next.progress,
    },
    course,
  );
}
