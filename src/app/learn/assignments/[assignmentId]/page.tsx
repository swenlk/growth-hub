import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TrackedVideoPlayer } from "@/components/TrackedVideoPlayer";
import { StatusBadge } from "@/components/dashboard/status-badge";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { assignmentStatusLabel, formatDay, isOverdue, watchedPercent } from "@/lib/assignment-view";
import { courseDurationSeconds, courseVideos } from "@/lib/course-videos";
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
  const videos = courseVideos(course);
  const durationSeconds = courseDurationSeconds(course);

  return (
    <>
      <DashboardBreadcrumb title={course.title} text="My training" nav="staff" backHref="/learn" />
      <div className="card">
        <h6 className="text-lg font-semibold">{course.title}</h6>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-300">
          <StatusBadge status={assignment.status} label={assignmentStatusLabel(assignment.status)} />
          <span>{watchedPercent(assignment.progress?.watchedSeconds ?? 0, durationSeconds)}% watched</span>
          <span>{assignment.dueDate ? `Due ${formatDay(assignment.dueDate)}` : "No due date"}</span>
          {isOverdue(assignment) ? <span className="font-medium text-destructive">Overdue</span> : null}
          {assignment.completedAt ? <span>Completed {formatDay(assignment.completedAt)}</span> : null}
        </div>
        {course.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
            {course.description}
          </p>
        ) : null}
        <div className="mt-5">
          <TrackedVideoPlayer
            assignmentId={assignment.assignmentId}
            courseId={course._id.toString()}
            durationSeconds={durationSeconds}
            clips={videos.map((video) => ({
              storedFileName: video.storedFileName,
              originalFileName: video.originalFileName,
              durationSeconds: video.durationSeconds,
            }))}
            initialStatus={assignment.status}
            initial={{
              watchedSeconds: assignment.progress?.watchedSeconds ?? 0,
              watchedPercent: watchedPercent(assignment.progress?.watchedSeconds ?? 0, durationSeconds),
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
