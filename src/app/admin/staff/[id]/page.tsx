import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { connectDB } from "@/lib/db";
import { requireRole, tenantObjectId } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";
import { StaffModel } from "@/models/Staff";

export const metadata: Metadata = {
  title: "Staff member",
};

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  const session = await requireRole("tenant_admin");
  if (!session.tenantId) notFound();
  await connectDB();

  const person = await StaffModel.findOne({
    _id: id,
    tenantId: tenantObjectId(session.tenantId),
  }).lean();
  if (!person) notFound();

  return (
    <>
      <DashboardBreadcrumb title={person.name} text="Staff member" />
      <div className="card mb-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-300">
          <Link href="/admin/staff" className="text-primary">
            Staff
          </Link>
        </p>
        <h6 className="mt-2 text-lg font-semibold">{person.name}</h6>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          {person.email}
          <span className="mx-2 text-neutral-300">/</span>
          <StatusBadge status={person.status} />
        </p>
      </div>
      <div className="card">
        <h6 className="mb-4 text-lg font-semibold">Assignment history</h6>
        {person.assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            No assignments yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>Assigned</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={headCell}>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {person.assignments.map((assignment, index) => {
                const cell = lastBodyCell(index === person.assignments.length - 1);
                return (
                  <TableRow key={assignment.assignmentId}>
                    <TableCell className={cell}>{assignment.assignedAt.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                    <TableCell className={cell}>
                      {assignment.completedAt ? assignment.completedAt.toISOString().slice(0, 10) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
