import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentFilters, AssignmentTable } from "@/components/dashboard/assignment-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { matchesAssignmentFilter, readAssignmentFilter } from "@/lib/assignment-view";
import { listAssignments } from "@/lib/assignments";
import { formatBytes, formatDuration } from "@/lib/format";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

import { setCourseStatusAction } from "../actions";
import { CourseStatusForm } from "../status-form";

export const metadata: Metadata = {
  title: "Course",
};

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();
  const filter = readAssignmentFilter((await searchParams).filter);

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const course = await models.Course.findById(id).lean();
  if (!course) notFound();
  const rows = (await listAssignments(models, { courseId: id })).filter((row) =>
    matchesAssignmentFilter(row, filter),
  );

  return (
    <>
      <DashboardBreadcrumb title={course.title} text="Course" backHref="/admin/courses" />
      <div className="card mb-4 !h-auto">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h6 className="text-lg font-semibold">{course.title}</h6>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-300">
              <StatusBadge status={course.status} label={course.status === "archived" ? "Inactive" : undefined} />
              <span>{formatDuration(course.video.durationSeconds)}</span>
              <span>{formatBytes(course.video.sizeBytes)}</span>
              <span>{course.video.originalFileName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/courses/${course._id.toString()}/edit`}>Edit</Link>
            </Button>
            <CourseStatusForm courseId={course._id.toString()} status={course.status} action={setCourseStatusAction} />
          </div>
        </div>
        {course.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
            {course.description}
          </p>
        ) : null}
      </div>
      <div className="card">
        <h6 className="mb-1 text-lg font-semibold">Preview</h6>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-300">
          This preview does not record watch progress. Staff progress is tracked on each assignment.
        </p>
        <video
          controls
          controlsList="nodownload"
          preload="metadata"
          playsInline
          className="max-h-[480px] w-full rounded-md bg-black"
          src={`/api/media/${course._id.toString()}`}
        />
      </div>
      <div className="card mt-4">
        <h6 className="mb-1 text-lg font-semibold">Assignments</h6>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-300">
          Repeated assignments of this course stay on their own rows.
        </p>
        <AssignmentFilters pathname={`/admin/courses/${course._id.toString()}`} filter={filter} />
        <AssignmentTable
          rows={rows}
          showCourse={false}
          empty={filter === "all" ? "No assignments for this course yet." : "No assignments match this filter."}
        />
      </div>
    </>
  );
}
