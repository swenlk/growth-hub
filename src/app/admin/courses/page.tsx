import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { connectDB } from "@/lib/db";
import { formatBytes, formatDuration } from "@/lib/format";
import { maxUploadBytes } from "@/lib/media";
import { requireRole, tenantObjectId } from "@/lib/rbac";
import { CourseModel } from "@/models/Course";

import { CourseCreateForm } from "./course-form";

export const metadata: Metadata = {
  title: "Courses",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const session = await requireRole("tenant_admin");
  if (!session.tenantId) {
    throw new Error("Your account is not assigned to a tenant");
  }
  await connectDB();
  const courses = await CourseModel.find({ tenantId: tenantObjectId(session.tenantId) })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <>
      <DashboardBreadcrumb title="Courses" text="Library" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="card">
            <h6 className="mb-1 text-lg font-semibold">New course</h6>
            <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-300">
              A course is a title and one video. The file is stored for this organization and streamed
              back when someone watches it.
            </p>
            <CourseCreateForm maxBytes={maxUploadBytes()} />
          </div>
        </div>
        <div className="xl:col-span-8">
          <div className="card">
            <h6 className="mb-4 text-lg font-semibold">Courses</h6>
            {courses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
                No courses yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={headCell}>Title</TableHead>
                    <TableHead className={headCell}>Length</TableHead>
                    <TableHead className={headCell}>Size</TableHead>
                    <TableHead className={headCell}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course, index) => {
                    const cell = lastBodyCell(index === courses.length - 1);
                    return (
                      <TableRow key={String(course._id)}>
                        <TableCell className={`${cell} font-medium`}>
                          <Link href={`/admin/courses/${course._id.toString()}`} className="text-primary">
                            {course.title}
                          </Link>
                        </TableCell>
                        <TableCell className={cell}>{formatDuration(course.video.durationSeconds)}</TableCell>
                        <TableCell className={cell}>{formatBytes(course.video.sizeBytes)}</TableCell>
                        <TableCell className={cell}>
                          <StatusBadge status={course.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
