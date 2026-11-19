import type { Metadata } from "next";
import Link from "next/link";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { formatDay, isOverdue, watchedPercent } from "@/lib/assignment-view";
import { getTenantContext, requireRole } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "My training",
};

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  await requireRole("staff");
  const { models, session } = await getTenantContext();
  const person = await models.Staff.findOne({ keycloakUserId: session.sub }).lean();
  const assignments = person?.assignments ?? [];
  const courseIds = [...new Set(assignments.map((item) => String(item.courseId)))];
  const courses = await models.Course.find({ _id: { $in: courseIds } }).select("title video.durationSeconds").lean();
  const courseById = new Map(courses.map((course) => [String(course._id), course]));

  const cards = assignments
    .map((assignment) => {
      const course = courseById.get(String(assignment.courseId));
      const duration = course?.video.durationSeconds ?? 0;
      const watched = assignment.progress?.watchedSeconds ?? 0;
      return {
        assignmentId: assignment.assignmentId,
        title: course?.title ?? "Course removed",
        status: assignment.status,
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt,
        percent: watchedPercent(watched, duration),
        overdue: isOverdue(assignment),
        assignedAt: assignment.assignedAt,
      };
    })
    .sort((left, right) => right.assignedAt.getTime() - left.assignedAt.getTime());

  const open = cards.filter((card) => card.status !== "completed");
  const completed = cards.filter((card) => card.status === "completed");

  return (
    <>
      <DashboardBreadcrumb title="My training" text="Assigned" />
      <section>
        <h6 className="mb-4 text-lg font-semibold">Assigned</h6>
        {open.length === 0 ? (
          <Empty>Nothing assigned.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {open.map((card) => (
              <article key={card.assignmentId} className="card">
                <h6 className="text-lg font-semibold">{card.title}</h6>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-300">
                  {card.status === "in_progress" ? "In progress" : "Not started"}
                  {card.dueDate ? ` · Due ${formatDay(card.dueDate)}` : ""}
                  {card.overdue ? <span className="text-destructive"> · Overdue</span> : null}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-slate-600">
                  <div className="h-full bg-primary" style={{ width: `${card.percent}%` }} />
                </div>
                <p className="mt-2 text-sm text-neutral-500">{card.percent}% watched</p>
                <Link href={`/learn/assignments/${card.assignmentId}`} className="mt-4 inline-block text-sm font-medium text-primary">
                  Watch
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="mt-8">
        <h6 className="mb-4 text-lg font-semibold">Completed</h6>
        {completed.length === 0 ? (
          <Empty>No completed courses.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {completed.map((card) => (
              <article key={card.assignmentId} className="card">
                <h6 className="text-lg font-semibold">{card.title}</h6>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-300">
                  Completed {formatDay(card.completedAt)}
                </p>
                <Link href={`/learn/assignments/${card.assignmentId}`} className="mt-4 inline-block text-sm font-medium text-primary">
                  Review
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
      {children}
    </div>
  );
}
