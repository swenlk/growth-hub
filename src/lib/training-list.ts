import "server-only";

import { formatDay, isOverdue, watchedPercent } from "@/lib/assignment-view";
import { courseDurationSeconds } from "@/lib/course-videos";
import type { AssignmentStatus } from "@/lib/domain";
import { AuthzError, getTenantContext, type TenantContext } from "@/lib/rbac";

export type TrainingCourse = {
  assignmentId: string;
  title: string;
  status: AssignmentStatus;
  dueLabel: string;
  completedLabel: string;
  percent: number;
  overdue: boolean;
};

type ListedAssignment = {
  assignmentId: string;
  courseId: { toString(): string };
  assignedAt: Date;
  dueDate?: Date;
  status: AssignmentStatus;
  completedAt?: Date;
  progress?: { watchedSeconds?: number };
};

/** Courses for the signed-in staff member in one status. Other statuses stay out of the result. */
export async function listOwnTraining(ctx: TenantContext, status: AssignmentStatus): Promise<TrainingCourse[]> {
  const rows = await ctx.models.Staff.aggregate<{ assignments: ListedAssignment[] }>([
    { $match: { keycloakUserId: ctx.session.sub } },
    {
      $project: {
        _id: 0,
        assignments: {
          $filter: {
            input: "$assignments",
            as: "item",
            cond: { $eq: ["$$item.status", status] },
          },
        },
      },
    },
  ]);

  const assignments = rows[0]?.assignments ?? [];
  if (assignments.length === 0) return [];

  const courseIds = [...new Set(assignments.map((item) => String(item.courseId)))];
  const courses = await ctx.models.Course.find({ _id: { $in: courseIds } })
    .select("title video.durationSeconds videos.durationSeconds")
    .lean();
  const courseById = new Map(courses.map((course) => [String(course._id), course]));

  return assignments
    .toSorted((left, right) => new Date(right.assignedAt).getTime() - new Date(left.assignedAt).getTime())
    .map((assignment) => {
      const course = courseById.get(String(assignment.courseId));
      const duration = course ? courseDurationSeconds(course) : 0;
      const watched = assignment.progress?.watchedSeconds ?? 0;
      return {
        assignmentId: assignment.assignmentId,
        title: course?.title ?? "Course removed",
        status: assignment.status,
        dueLabel: assignment.dueDate ? formatDay(new Date(assignment.dueDate)) : "",
        completedLabel: formatDay(assignment.completedAt ? new Date(assignment.completedAt) : null),
        percent: watchedPercent(watched, duration),
        overdue: isOverdue({
          status: assignment.status,
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
        }),
      };
    });
}

export async function trainingListResponse(status: AssignmentStatus) {
  try {
    const ctx = await getTenantContext();
    if (!ctx.session.roles.includes("staff")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.json({ courses: await listOwnTraining(ctx, status) });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Training list failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Could not load training" }, { status: 500 });
  }
}
