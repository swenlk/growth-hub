import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ListPager } from "@/components/dashboard/list-pager";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CourseStatus } from "@/lib/domain";
import { courseDurationSeconds, courseSizeBytes } from "@/lib/course-videos";
import { formatBytes, formatDuration } from "@/lib/format";
import { readChoice, readText, withListQuery } from "@/lib/list-search";
import { getTenantContext, requireRole } from "@/lib/rbac";

const pageSize = 10;
const COURSE_STATUSES = ["active", "archived"] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function courseListHref(search: { q: string; status: CourseStatus | ""; page: number }, path = "/admin/courses") {
  return withListQuery(path, { q: search.q, status: search.status, page: search.page > 1 ? search.page : 0 });
}

export const metadata: Metadata = {
  title: "Courses",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const query = await searchParams;
  const q = readText(query.q);
  const status = readChoice(query.status, COURSE_STATUSES);
  const requested = Number(query.page);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
  const total = await models.Course.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  const courses = await models.Course.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + courses.length;

  return (
    <>
      <DashboardBreadcrumb title="Courses" text="Library" hint="A course can include more than one video. Open it to see who is assigned." />
      <div className="card flex flex-1 flex-col !h-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <Input name="q" defaultValue={q} placeholder="Course title" aria-label="Search course title" className="w-56" />
            <SearchableSelect
              name="status"
              ariaLabel="Status"
              defaultValue={status}
              className="min-w-40"
              options={[
                { value: "", label: "All status" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Inactive" },
              ]}
            />
            <Button type="submit">Search</Button>
          </form>
          <Button asChild>
            <Link href="/admin/courses/new">Add course</Link>
          </Button>
        </div>
        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            {q || status ? "No courses match this search." : "No courses yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>#</TableHead>
                <TableHead className={headCell}>Title</TableHead>
                <TableHead className={headCell}>Length</TableHead>
                <TableHead className={headCell}>Size</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={headCell}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course, index) => {
                const cell = lastBodyCell(index === courses.length - 1);
                return (
                  <TableRow key={String(course._id)}>
                    <TableCell className={cell}>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className={`${cell} font-medium`}>{course.title}</TableCell>
                    <TableCell className={cell}>{formatDuration(courseDurationSeconds(course))}</TableCell>
                    <TableCell className={cell}>{formatBytes(courseSizeBytes(course))}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={course.status} label={course.status === "archived" ? "Inactive" : undefined} />
                    </TableCell>
                    <TableCell className={cell}>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={courseListHref({ q, status, page }, `/admin/courses/${course._id.toString()}/edit`)}
                          aria-label={`Edit ${course.title}`}
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
          hrefFor={(number) => courseListHref({ q, status, page: number })}
        />
      </div>
    </>
  );
}
