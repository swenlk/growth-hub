import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentTable } from "@/components/dashboard/assignment-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { listAssignments } from "@/lib/assignments";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

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

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const person = await models.Staff.findById(id).select("name email status").lean();
  if (!person) notFound();
  const rows = await listAssignments(models, { staffId: id });

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
        <AssignmentTable rows={rows} showStaff={false} empty="No assignments yet." />
      </div>
    </>
  );
}
