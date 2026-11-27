import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { courseDocuments, courseVideos } from "@/lib/course-videos";
import type { CourseStatus } from "@/lib/domain";
import { readChoice, readPage, readText, withListQuery } from "@/lib/list-search";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

import { updateCourseAction } from "../../actions";
import { CourseEditForm } from "../../edit-form";

export const metadata: Metadata = {
  title: "Edit course",
};

export const dynamic = "force-dynamic";

const COURSE_STATUSES = ["active", "archived"] as const satisfies readonly CourseStatus[];

export default async function EditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const course = await models.Course.findById(id).select("title description status video videos documents").lean();
  if (!course) notFound();

  return (
    <>
      <DashboardBreadcrumb
        title="Edit course"
        text="Courses"
        hint="Add videos or PDFs, or remove ones that should no longer be available."
        backHref={withListQuery("/admin/courses", {
          q: readText(query.q),
          status: readChoice(query.status, COURSE_STATUSES),
          page: readPage(query.page),
        })}
      />
      <div className="card !h-auto">
        <CourseEditForm
          courseId={id}
          title={course.title}
          description={course.description ?? ""}
          status={course.status}
          videos={courseVideos(course).map((video) => ({
            storedFileName: video.storedFileName,
            originalFileName: video.originalFileName,
            durationSeconds: video.durationSeconds,
            sizeBytes: video.sizeBytes,
          }))}
          documents={courseDocuments(course).map((pdf) => ({
            storedFileName: pdf.storedFileName,
            originalFileName: pdf.originalFileName,
            sizeBytes: pdf.sizeBytes,
          }))}
          action={updateCourseAction}
        />
      </div>
    </>
  );
}
