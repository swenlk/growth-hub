import type { Metadata } from "next";

import { AssignmentFilters, AssignmentTable } from "@/components/dashboard/assignment-table";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { matchesAssignmentFilter, readAssignmentFilter } from "@/lib/assignment-view";
import { listAssignments } from "@/lib/assignments";
import { getTenantContext, requireRole } from "@/lib/rbac";

import { assignCourseAction } from "./actions";
import { AssignForm } from "./assign-form";

export const metadata: Metadata = {
  title: "Assignments",
};

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const filter = readAssignmentFilter((await searchParams).filter);

  const [courses, staff, rows] = await Promise.all([
    models.Course.find({ status: "active" }).sort({ title: 1 }).select("title").lean(),
    models.Staff.find({ status: "active" }).sort({ name: 1 }).select("name email").lean(),
    listAssignments(models),
  ]);
  const visible = rows.filter((row) => matchesAssignmentFilter(row, filter));

  return (
    <>
      <DashboardBreadcrumb title="Assignments" text="Assign" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="card">
            <h6 className="mb-1 text-lg font-semibold">Assign a course</h6>
            <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-300">
              Choose one course and one or more people. Repeating an assignment does not change the
              earlier one.
            </p>
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
        </div>
        <div className="xl:col-span-8">
          <div className="card">
            <h6 className="mb-4 text-lg font-semibold">Assignment history</h6>
            <AssignmentFilters pathname="/admin/assignments" filter={filter} />
            <AssignmentTable
              rows={visible}
              empty={filter === "all" ? "No assignments yet." : "No assignments match this filter."}
            />
          </div>
        </div>
      </div>
    </>
  );
}
