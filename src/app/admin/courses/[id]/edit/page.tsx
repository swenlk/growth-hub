import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { maxUploadBytes } from "@/lib/media";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

import { updateCourseAction } from "../../actions";
import { CourseEditForm } from "../../edit-form";

export const metadata: Metadata = {
  title: "Edit course",
};

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const course = await models.Course.findById(id).select("title description status video.originalFileName").lean();
  if (!course) notFound();

  return (
    <>
      <DashboardBreadcrumb title="Edit course" text="Library" />
      <div className="card !h-auto">
        <CourseEditForm
          courseId={id}
          title={course.title}
          description={course.description ?? ""}
          status={course.status}
          fileName={course.video.originalFileName}
          maxBytes={maxUploadBytes()}
          action={updateCourseAction}
        />
      </div>
    </>
  );
}
