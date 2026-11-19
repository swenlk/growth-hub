import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ListPager } from "@/components/dashboard/list-pager";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignmentStatusLabel, formatDay, isOverdue, watchedPercent } from "@/lib/assignment-view";
import { listAssignments } from "@/lib/assignments";
import type { AssignmentStatus } from "@/lib/domain";
import { getTenantContext, requireRole } from "@/lib/rbac";

const pageSize = 10;

const selectClass =
  "border-input dark:bg-input/30 h-8 min-w-40 rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const STATUSES: AssignmentStatus[] = ["assigned", "in_progress", "completed"];

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readId(value: string | string[] | undefined) {
  const raw = readQuery(value)?.trim() ?? "";
  return /^[a-f\d]{24}$/i.test(raw) ? raw : "";
}

function readStatus(value: string | string[] | undefined): AssignmentStatus | "" {
  const raw = readQuery(value);
  if (raw === "assigned" || raw === "in_progress" || raw === "completed") return raw;
  return "";
}

function assignmentPageHref(
  page: number,
  search: { staffId: string; courseId: string; status: AssignmentStatus | "" },
) {
  const params = new URLSearchParams();
  if (search.staffId) params.set("staff", search.staffId);
  if (search.courseId) params.set("course", search.courseId);
  if (search.status) params.set("status", search.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/assignments?${query}` : "/admin/assignments";
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
  const staffId = readId(query.staff);
  const courseId = readId(query.course);
  const status = readStatus(query.status);
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
      <DashboardBreadcrumb title="Assignments" text="Assign" />
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h6 className="text-lg font-semibold">Assignments</h6>
          <Button asChild>
            <Link href="/admin/assignments/new">Add assignment</Link>
          </Button>
        </div>
        <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
          <select name="staff" defaultValue={staffId} className={selectClass} aria-label="Staff">
            <option value="">Staff</option>
            {staff.map((person) => (
              <option key={String(person._id)} value={String(person._id)}>
                {person.name}
              </option>
            ))}
          </select>
          <select name="course" defaultValue={courseId} className={selectClass} aria-label="Course">
            <option value="">Course</option>
            {courses.map((course) => (
              <option key={String(course._id)} value={String(course._id)}>
                {course.title}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className={selectClass} aria-label="Status">
            <option value="">Not completed</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {assignmentStatusLabel(value)}
              </option>
            ))}
          </select>
          <Button type="submit">Search</Button>
        </form>
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
                      {formatDay(row.dueDate)}
                      {overdue ? <span className="ml-2 text-destructive">Overdue</span> : null}
                    </TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={row.status} label={assignmentStatusLabel(row.status)} />
                    </TableCell>
                    <TableCell className={cell}>{watchedPercent(row.watchedSeconds, row.durationSeconds)}%</TableCell>
                    <TableCell className={cell}>{formatDay(row.completedAt)}</TableCell>
                    <TableCell className={cell}>
                      <Button asChild size="icon" variant="outline" className="size-8">
                        <Link href={`/admin/assignments/${row.assignmentId}/edit`} aria-label={`Edit ${row.staffName}`}>
                          <Pencil />
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
          hrefFor={(number) => assignmentPageHref(number, { staffId, courseId, status })}
        />
      </div>
    </>
  );
}
