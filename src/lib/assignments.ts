import "server-only";

import { randomUUID } from "node:crypto";

import { dueDateFromInput, emptyProgress } from "@/lib/assignment-view";
import type { AssignmentStatus } from "@/lib/domain";
import type { TenantContext } from "@/lib/rbac";
import { createAssignmentSchema, type CreateAssignmentInput } from "@/lib/validators";

export class AssignmentError extends Error {}

export type AssignmentRow = {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  durationSeconds: number;
  staffId: string;
  staffName: string;
  assignedAt: Date;
  dueDate?: Date;
  status: AssignmentStatus;
  watchedSeconds: number;
  completedAt?: Date;
};

type AssignmentWriter = Pick<TenantContext, "models" | "session">;

/**
 * Push one new assignment per staff member.
 * A person who already has the course gets another object with its own assignmentId.
 * The previous assignment is left as it is.
 */
export async function assignCourse(ctx: AssignmentWriter, input: CreateAssignmentInput): Promise<number> {
  const parsed = createAssignmentSchema.parse(input);
  const dueDate = parsed.dueDate ? dueDateFromInput(parsed.dueDate) : undefined;
  const course = await ctx.models.Course.findById(parsed.courseId).select("status").lean();
  if (!course) {
    throw new AssignmentError("Course not found");
  }
  if (course.status !== "active") {
    throw new AssignmentError("That course is archived");
  }

  const staffIds = [...new Set(parsed.staffIds)];
  const people = await ctx.models.Staff.find({ _id: { $in: staffIds }, status: "active" })
    .select("_id")
    .lean();
  if (people.length !== staffIds.length) {
    throw new AssignmentError("Choose active staff in this organization");
  }

  const assignedAt = new Date();
  const result = await ctx.models.Staff.bulkWrite(
    people.map((person) => ({
      updateOne: {
        filter: { _id: person._id },
        update: {
          $push: {
            assignments: {
              assignmentId: randomUUID(),
              courseId: course._id,
              assignedAt,
              assignedBy: ctx.session.sub,
              ...(dueDate ? { dueDate } : {}),
              status: "assigned",
              progress: emptyProgress(),
            },
          },
        },
      },
    })),
  );

  if (result.modifiedCount !== people.length) {
    throw new AssignmentError("Some staff could not be assigned");
  }
  return people.length;
}

export async function listAssignments(
  models: TenantContext["models"],
  options: { courseId?: string; staffId?: string } = {},
): Promise<AssignmentRow[]> {
  const people = await models.Staff.find(options.staffId ? { _id: options.staffId } : {})
    .select("name assignments")
    .lean();

  const courseIds = new Set<string>();
  for (const person of people) {
    for (const assignment of person.assignments) {
      if (options.courseId && String(assignment.courseId) !== options.courseId) continue;
      courseIds.add(String(assignment.courseId));
    }
  }

  const courses = await models.Course.find({ _id: { $in: [...courseIds] } })
    .select("title video.durationSeconds")
    .lean();
  const titles = new Map(courses.map((course) => [String(course._id), course]));

  const rows: AssignmentRow[] = [];
  for (const person of people) {
    for (const assignment of person.assignments) {
      const courseId = String(assignment.courseId);
      if (options.courseId && courseId !== options.courseId) continue;
      const course = titles.get(courseId);
      rows.push({
        assignmentId: assignment.assignmentId,
        courseId,
        courseTitle: course?.title ?? "Course removed",
        durationSeconds: course?.video.durationSeconds ?? 0,
        staffId: String(person._id),
        staffName: person.name,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        status: assignment.status,
        watchedSeconds: assignment.progress?.watchedSeconds ?? 0,
        completedAt: assignment.completedAt,
      });
    }
  }

  rows.sort((left, right) => right.assignedAt.getTime() - left.assignedAt.getTime());
  return rows;
}
