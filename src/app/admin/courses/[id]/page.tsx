import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/dashboard/status-badge";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { connectDB } from "@/lib/db";
import { formatBytes, formatDuration } from "@/lib/format";
import { requireRole, tenantObjectId } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";
import { CourseModel } from "@/models/Course";

import { setCourseStatusAction } from "../actions";
import { CourseStatusForm } from "../status-form";

export const metadata: Metadata = {
  title: "Course",
};

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  const session = await requireRole("tenant_admin");
  if (!session.tenantId) notFound();
  await connectDB();

  const course = await CourseModel.findOne({
    _id: id,
    tenantId: tenantObjectId(session.tenantId),
  }).lean();
  if (!course) notFound();

  return (
    <>
      <DashboardBreadcrumb title={course.title} text="Course" />
      <div className="card mb-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-300">
          <Link href="/admin/courses" className="text-primary">
            Courses
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h6 className="text-lg font-semibold">{course.title}</h6>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              <StatusBadge status={course.status} />
              <span className="mx-2 text-neutral-300">/</span>
              {formatDuration(course.video.durationSeconds)}
              <span className="mx-2 text-neutral-300">/</span>
              {formatBytes(course.video.sizeBytes)}
              <span className="mx-2 text-neutral-300">/</span>
              {course.video.originalFileName}
            </p>
          </div>
          <CourseStatusForm courseId={course._id.toString()} status={course.status} action={setCourseStatusAction} />
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
          preload="metadata"
          playsInline
          className="max-h-[480px] w-full rounded-md bg-black"
          src={`/api/media/${course._id.toString()}`}
        />
      </div>
    </>
  );
}
