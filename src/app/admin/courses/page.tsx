import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ListPager } from "@/components/dashboard/list-pager";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatDuration } from "@/lib/format";
import { getTenantContext, requireRole } from "@/lib/rbac";

const pageSize = 10;

function coursePageHref(page: number) {
  return page <= 1 ? "/admin/courses" : `/admin/courses?page=${page}`;
}

export const metadata: Metadata = {
  title: "Courses",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const requested = Number((await searchParams).page);
  const total = await models.Course.countDocuments();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  const courses = await models.Course.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + courses.length;

  return (
    <>
      <DashboardBreadcrumb title="Courses" text="Library" />
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h6 className="text-lg font-semibold">Courses</h6>
          <Button asChild>
            <Link href="/admin/courses/new">Add course</Link>
          </Button>
        </div>
        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            No courses yet.
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
                    <TableCell className={cell}>{formatDuration(course.video.durationSeconds)}</TableCell>
                    <TableCell className={cell}>{formatBytes(course.video.sizeBytes)}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={course.status} label={course.status === "archived" ? "Inactive" : undefined} />
                    </TableCell>
                    <TableCell className={cell}>
                      <Button asChild size="icon" variant="outline" className="size-8">
                        <Link href={`/admin/courses/${course._id.toString()}/edit`} aria-label={`Edit ${course.title}`}>
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
        <ListPager page={page} pageCount={pageCount} total={total} start={start} end={end} hrefFor={coursePageHref} />
      </div>
    </>
  );
}
