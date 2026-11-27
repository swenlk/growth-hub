import type { Metadata } from "next";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { requireRole } from "@/lib/rbac";

import { CourseCreateForm } from "../course-form";

export const metadata: Metadata = {
  title: "Add course",
};

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  await requireRole("tenant_admin");

  return (
    <>
      <DashboardBreadcrumb title="Add course" text="Courses" hint="Upload one or more videos. Each length is read before it is saved." backHref="/admin/courses" />
      <div className="card !h-auto">
        <CourseCreateForm />
      </div>
    </>
  );
}
