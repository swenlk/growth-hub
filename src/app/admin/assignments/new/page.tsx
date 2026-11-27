import type { Metadata } from "next";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { getTenantContext, requireRole } from "@/lib/rbac";

import { assignCourseAction } from "../actions";
import { AssignForm } from "../assign-form";

export const metadata: Metadata = {
  title: "Add assignment",
};

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const [courses, staff] = await Promise.all([
    models.Course.find({ status: "active" }).sort({ title: 1 }).select("title").lean(),
    models.Staff.find({ status: "active" }).sort({ name: 1 }).select("name email").lean(),
  ]);

  return (
    <>
      <DashboardBreadcrumb title="Add assignment" text="Assignments" hint="Pick a course, a due date, and the people who should watch it." backHref="/admin/assignments" />
      <div className="card !h-auto">
        <AssignForm
          action={assignCourseAction}
          courses={courses.map((course) => ({ id: course._id.toString(), title: course.title }))}
          staff={staff.map((person) => ({
            id: person._id.toString(),
            name: person.name,
            email: person.email,
          }))}
        />
      </div>
    </>
  );
}
