import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay, isOverdue, watchedPercent, assignmentStatusLabel, type AssignmentFilter } from "@/lib/assignment-view";
import type { AssignmentRow } from "@/lib/assignments";

import { OverdueNote, StatusBadge, WatchedMeter } from "./status-badge";
import { headCell, lastBodyCell } from "./table-styles";

const FILTERS: { id: AssignmentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "open", label: "Not completed" },
  { id: "overdue", label: "Overdue" },
];

export function filterHref(pathname: string, filter: AssignmentFilter, courseId?: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (courseId) params.set("course", courseId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function AssignmentFilters({
  pathname,
  filter,
  courseId,
}: {
  pathname: string;
  filter: AssignmentFilter;
  courseId?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {FILTERS.map((item) => {
        const active = item.id === filter;
        return (
          <Link
            key={item.id}
            href={filterHref(pathname, item.id, courseId)}
            className={
              active
                ? "rounded-md bg-primary px-3 py-1.5 text-sm text-white"
                : "rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 dark:border-slate-600 dark:text-neutral-300"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AssignmentTable({
  rows,
  showStaff = true,
  showCourse = true,
  empty,
}: {
  rows: AssignmentRow[];
  showStaff?: boolean;
  showCourse?: boolean;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
        {empty}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showStaff ? <TableHead className={headCell}>Staff</TableHead> : null}
          {showCourse ? <TableHead className={headCell}>Course</TableHead> : null}
          <TableHead className={headCell}>Assigned</TableHead>
          <TableHead className={headCell}>Due</TableHead>
          <TableHead className={headCell}>Status</TableHead>
          <TableHead className={headCell}>Watched</TableHead>
          <TableHead className={headCell}>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const cell = lastBodyCell(index === rows.length - 1);
          const overdue = isOverdue(row);
          return (
            <TableRow key={row.assignmentId}>
              {showStaff ? (
                <TableCell className={`${cell} font-medium`}>
                  <Link href={`/admin/staff/${row.staffId}`} className="text-primary">
                    {row.staffName}
                  </Link>
                </TableCell>
              ) : null}
              {showCourse ? (
                <TableCell className={`${cell} font-medium`}>
                  <Link href={`/admin/courses/${row.courseId}`} className="text-primary">
                    {row.courseTitle}
                  </Link>
                </TableCell>
              ) : null}
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
