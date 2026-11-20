import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ListPager } from "@/components/dashboard/list-pager";
import { OverdueNote, StatusBadge, WatchedMeter } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignmentStatusLabel, formatDay, isOverdue, watchedPercent } from "@/lib/assignment-view";
import { listAssignments } from "@/lib/assignments";
import type { AssignmentStatus } from "@/lib/domain";
import { readChoice, readObjectId, withListQuery } from "@/lib/list-search";
import { getTenantContext, requireRole } from "@/lib/rbac";

const pageSize = 10;

const STATUSES: AssignmentStatus[] = ["assigned", "in_progress", "completed"];

function assignmentListHref(
  search: { staffId: string; courseId: string; status: AssignmentStatus | ""; page: number },
  path = "/admin/assignments",
) {
  return withListQuery(path, {
    staff: search.staffId,
    course: search.courseId,
    status: search.status,
    page: search.page > 1 ? search.page : 0,
  });
}

export const metadata: Metadata = {
  title: "Assignments",
};

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; course?: string; status?: string; page?: string }>;
}) {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const query = await searchParams;
  const staffId = readObjectId(query.staff);
  const courseId = readObjectId(query.course);
  const status = readChoice(query.status, STATUSES);
  const requested = Number(query.page);
  const [assignments, staff, courses] = await Promise.all([
    listAssignments(models),
    models.Staff.find().sort({ name: 1 }).select("name").lean(),
    models.Course.find().sort({ title: 1 }).select("title").lean(),
  ]);
  const rows = assignments.filter((row) => {
    if (staffId && row.staffId !== staffId) return false;
    if (courseId && row.courseId !== courseId) return false;
    if (status) return row.status === status;
    return row.status !== "completed";
  });
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + visible.length;

  return (
    <>
      <DashboardBreadcrumb title="Assignments" text="Assign" hint="See who has which course, and open a row to change it." />
      <div className="card flex flex-1 flex-col !h-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <SearchableSelect
              name="staff"
              ariaLabel="Staff"
              defaultValue={staffId}
              className="min-w-40"
              options={[
                { value: "", label: "All staff" },
                ...staff.map((person) => ({ value: String(person._id), label: person.name })),
              ]}
            />
            <SearchableSelect
              name="course"
              ariaLabel="Course"
              defaultValue={courseId}
              className="min-w-40"
              options={[
                { value: "", label: "All courses" },
                ...courses.map((course) => ({ value: String(course._id), label: course.title })),
              ]}
            />
            <SearchableSelect
              name="status"
              ariaLabel="Status"
              defaultValue={status}
              className="min-w-40"
              options={[
                { value: "", label: "Not completed" },
                ...STATUSES.map((value) => ({ value, label: assignmentStatusLabel(value) })),
              ]}
            />
            <Button type="submit">Search</Button>
          </form>
          <Button asChild>
            <Link href="/admin/assignments/new">Add assignment</Link>
          </Button>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            No assignments match this search.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>#</TableHead>
                <TableHead className={headCell}>Staff</TableHead>
                <TableHead className={headCell}>Course</TableHead>
                <TableHead className={headCell}>Assigned</TableHead>
                <TableHead className={headCell}>Due</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={headCell}>Watched</TableHead>
                <TableHead className={headCell}>Completed</TableHead>
                <TableHead className={headCell}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row, index) => {
                const cell = lastBodyCell(index === visible.length - 1);
                const overdue = isOverdue(row);
                return (
                  <TableRow key={row.assignmentId}>
                    <TableCell className={cell}>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className={`${cell} font-medium`}>{row.staffName}</TableCell>
                    <TableCell className={`${cell} font-medium`}>{row.courseTitle}</TableCell>
                    <TableCell className={cell}>{formatDay(row.assignedAt)}</TableCell>
                    <TableCell className={cell}>
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {formatDay(row.dueDate)}
                        {overdue ? <OverdueNote /> : null}
                      </span>
                    </TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={row.status} label={assignmentStatusLabel(row.status)} />
                    </TableCell>
                    <TableCell className={cell}>
                      <WatchedMeter percent={watchedPercent(row.watchedSeconds, row.durationSeconds)} />
                    </TableCell>
                    <TableCell className={cell}>{formatDay(row.completedAt)}</TableCell>
                    <TableCell className={cell}>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={assignmentListHref(
                            { staffId, courseId, status, page },
                            `/admin/assignments/${row.assignmentId}/edit`,
                          )}
                          aria-label={`Edit ${row.staffName}`}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <ListPager
          page={page}
          pageCount={pageCount}
          total={total}
          start={start}
          end={end}
          hrefFor={(number) => assignmentListHref({ staffId, courseId, status, page: number })}
        />
      </div>
    </>
  );
}
