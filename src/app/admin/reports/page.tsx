import type { Metadata } from "next";

import { AssignmentFilters, AssignmentTable } from "@/components/dashboard/assignment-table";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { matchesAssignmentFilter, readAssignmentFilter } from "@/lib/assignment-view";
import { listAssignments } from "@/lib/assignments";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Reports",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; course?: string }>;
}) {
  await requireRole("tenant_admin");
  const query = await searchParams;
  const filter = readAssignmentFilter(query.filter);
  const courseId = objectIdSchema.safeParse(query.course).success ? query.course : undefined;
  const { models } = await getTenantContext();

  const [courses, rows] = await Promise.all([
    models.Course.find().sort({ title: 1 }).select("title").lean(),
    listAssignments(models, courseId ? { courseId } : {}),
  ]);
  const visible = rows.filter((row) => matchesAssignmentFilter(row, filter));

  return (
    <>
      <DashboardBreadcrumb title="Reports" text="Completion" />
      <div className="card">
        <h6 className="mb-1 text-lg font-semibold">Completion</h6>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-300">
          Each assignment is its own row, including the same course given to the same person more
          than once. Watched percent is the share of the video covered by saved playback.
        </p>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <label className="grid gap-2 text-sm font-medium">
            Course
            <select
              name="course"
              defaultValue={courseId ?? ""}
              className="border-input dark:bg-input/30 h-8 min-w-56 rounded-md border bg-transparent px-2.5 text-sm"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course._id.toString()} value={course._id.toString()}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-8 rounded-md bg-primary px-3 text-sm text-white"
          >
            Apply
          </button>
        </form>
        <AssignmentFilters pathname="/admin/reports" filter={filter} courseId={courseId} />
        <AssignmentTable
          rows={visible}
          empty={filter === "all" && !courseId ? "No assignments yet." : "No assignments match this filter."}
        />
      </div>
    </>
  );
}
