import type { Metadata } from "next";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformModels } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

import { createTenantAction, setTenantStatusAction } from "./actions";
import { TenantStatusForm } from "./status-form";
import { TenantCreateForm } from "./tenant-form";

export const metadata: Metadata = {
  title: "Tenants",
};

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  await requireRole("super_admin");
  const { Tenant } = await getPlatformModels();
  const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();

  return (
    <>
      <DashboardBreadcrumb title="Tenants" text="Organizations" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <div className="card">
            <h6 className="mb-1 text-lg font-semibold">New organization</h6>
            <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-300">
              Each organization has its own database and video folder, plus one sign-in.
              Creating it also creates the first tenant admin. They sign in with the same button as everyone else.
            </p>
            <TenantCreateForm action={createTenantAction} />
          </div>
        </div>
        <div className="xl:col-span-7">
          <div className="card">
            <h6 className="mb-4 text-lg font-semibold">Organizations</h6>
            {tenants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
                No organizations yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={headCell}>Name</TableHead>
                    <TableHead className={headCell}>Slug</TableHead>
                    <TableHead className={headCell}>Status</TableHead>
                    <TableHead className={headCell}>Created</TableHead>
                    <TableHead className={headCell}>
                      <span className="sr-only">Access</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant, index) => {
                    const isLast = index === tenants.length - 1;
                    const cell = lastBodyCell(isLast);
                    return (
                      <TableRow key={String(tenant._id)}>
                        <TableCell className={`${cell} font-medium`}>{tenant.name}</TableCell>
                        <TableCell className={cell}>{tenant.slug}</TableCell>
                        <TableCell className={cell}>
                          <StatusBadge status={tenant.status} />
                        </TableCell>
                        <TableCell className={cell}>{tenant.createdAt.toISOString().slice(0, 10)}</TableCell>
                        <TableCell className={cell}>
                          <TenantStatusForm
                            slug={tenant.slug}
                            status={tenant.status}
                            action={setTenantStatusAction}
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
