import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { connectDB } from "@/lib/db";
import { requireRole, tenantObjectId } from "@/lib/rbac";
import { StaffModel } from "@/models/Staff";

import { createStaffAction, setStaffStatusAction } from "./actions";
import { StaffCreateForm } from "./staff-form";
import { StaffStatusForm } from "./status-form";

export const metadata: Metadata = {
  title: "Staff",
};

export const dynamic = "force-dynamic";

export default async function StaffListPage() {
  const session = await requireRole("tenant_admin");
  if (!session.tenantId) {
    throw new Error("Your account is not assigned to a tenant");
  }
  await connectDB();
  const staff = await StaffModel.find({ tenantId: tenantObjectId(session.tenantId) })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <>
      <DashboardBreadcrumb title="Staff" text="Directory" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="card">
            <h6 className="mb-1 text-lg font-semibold">Add staff</h6>
            <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-300">
              A new person is stored for this organization and given a sign-in in the same Keycloak
              realm. If the sign-in account cannot be created, the organization record is removed.
            </p>
            <StaffCreateForm action={createStaffAction} />
          </div>
        </div>
        <div className="xl:col-span-8">
          <div className="card">
            <h6 className="mb-4 text-lg font-semibold">People</h6>
            {staff.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
                No staff yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={headCell}>Name</TableHead>
                    <TableHead className={headCell}>Email</TableHead>
                    <TableHead className={headCell}>Status</TableHead>
                    <TableHead className={headCell}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((person, index) => {
                    const cell = lastBodyCell(index === staff.length - 1);
                    return (
                      <TableRow key={String(person._id)}>
                        <TableCell className={`${cell} font-medium`}>
                          <Link href={`/admin/staff/${person._id.toString()}`} className="text-primary">
                            {person.name}
                          </Link>
                        </TableCell>
                        <TableCell className={cell}>{person.email}</TableCell>
                        <TableCell className={cell}>
                          <StatusBadge status={person.status} />
                        </TableCell>
                        <TableCell className={cell}>
                          <StaffStatusForm
                            staffId={person._id.toString()}
                            status={person.status}
                            action={setStaffStatusAction}
                          />
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
