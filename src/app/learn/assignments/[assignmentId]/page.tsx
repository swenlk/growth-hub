import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TrackedVideoPlayer } from "@/components/TrackedVideoPlayer";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { formatDay, watchedPercent } from "@/lib/assignment-view";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { z } from "zod";

export const metadata: Metadata = {
  title: "Assignment",
};

export const dynamic = "force-dynamic";

export default async function AssignmentPlayerPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  if (!z.string().uuid().safeParse(assignmentId).success) notFound();

  await requireRole("staff");
  const { models, session } = await getTenantContext();
  const person = await models.Staff.findOne({ keycloakUserId: session.sub }).lean();
  const assignment = person?.assignments.find((item) => item.assignmentId === assignmentId);
  if (!assignment) notFound();
  const course = await models.Course.findById(assignment.courseId).lean();
  if (!course) notFound();

  return (
    <>
      <DashboardBreadcrumb title={course.title} text="Watch" />
      <div className="card">
        <p className="text-sm text-neutral-500 dark:text-neutral-300">
          <Link href="/learn" className="text-primary">
            My training
          </Link>
        </p>
        <h6 className="mt-2 text-lg font-semibold">{course.title}</h6>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-300">
          {assignment.dueDate ? `Due ${formatDay(assignment.dueDate)}` : "No due date"}
          {assignment.completedAt ? ` · Completed ${formatDay(assignment.completedAt)}` : ""}
        </p>
        {course.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
            {course.description}
          </p>
        ) : null}
        <div className="mt-5">
          <TrackedVideoPlayer
            assignmentId={assignment.assignmentId}
            courseId={course._id.toString()}
            durationSeconds={course.video.durationSeconds}
            initialStatus={assignment.status}
            initial={{
              watchedSeconds: assignment.progress?.watchedSeconds ?? 0,
              watchedPercent: watchedPercent(
                assignment.progress?.watchedSeconds ?? 0,
                course.video.durationSeconds,
              ),
              lastPositionSeconds: assignment.progress?.lastPositionSeconds ?? 0,
              videoCompleted: assignment.progress?.videoCompleted ?? false,
              watchedRanges: (assignment.progress?.watchedRanges ?? []).map(
                (range) => [Number(range[0]), Number(range[1])] as [number, number],
              ),
            }}
          />
        </div>
      </div>
    </>
  );
}
