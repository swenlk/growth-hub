import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformModels } from "@/lib/db";
import { TENANT_STATUSES } from "@/lib/domain";
import { KeycloakAdminError, listTenantAdmins, type TenantAdminAccount } from "@/lib/keycloak-admin";
import { readChoice, readPage, readText, withListQuery } from "@/lib/list-search";
import { requireRole } from "@/lib/rbac";
import { assertValidSlug, TenantSlugError } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Organization",
};

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  let safe = "";
  try {
    safe = assertValidSlug(slug);
  } catch (error) {
    if (error instanceof TenantSlugError) notFound();
    throw error;
  }

  await requireRole("super_admin");
  const { Tenant } = await getPlatformModels();
  const tenant = await Tenant.findOne({ tenant: safe }).lean();
  if (!tenant) notFound();

  let admins: TenantAdminAccount[] = [];
  let adminError: string | null = null;
  try {
    admins = await listTenantAdmins(safe);
  } catch (error) {
    if (error instanceof KeycloakAdminError) {
      adminError = "Admins could not be loaded.";
    } else {
      throw error;
    }
  }

  const backHref = withListQuery("/platform/tenants", {
    q: readText(query.q),
    status: readChoice(query.status, TENANT_STATUSES),
    page: readPage(query.page),
  });
  const head = `${headCell} !text-center`;

  return (
    <>
      <DashboardBreadcrumb text="Organization" backHref={backHref} />
      <div className="card w-full !h-auto">
        <div className="grid items-start gap-6 xl:grid-cols-3">
          <section>
            <h6 className="mb-4 text-lg font-semibold">Details</h6>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-neutral-500 dark:text-neutral-300">Name</dt>
                <dd className="mt-1 font-medium">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-300">Tenant</dt>
                <dd className="mt-1 font-medium">{tenant.tenant}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-300">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={tenant.status} label={tenant.status === "disabled" ? "Inactive" : undefined} />
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-300">Created</dt>
                <dd className="mt-1 font-medium">{tenant.createdAt.toISOString().slice(0, 10)}</dd>
              </div>
            </dl>
          </section>
          <section className="xl:col-span-2">
            <h6 className="mb-4 text-lg font-semibold">Admins</h6>
            {adminError ? (
              <p className="text-sm text-destructive">{adminError}</p>
            ) : admins.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
                No admins yet.
              </div>
            ) : (
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={head}>#</TableHead>
                  <TableHead className={head}>Name</TableHead>
                  <TableHead className={head}>Email</TableHead>
                  <TableHead className={head}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin, index) => {
                  const cell = `${lastBodyCell(index === admins.length - 1)} !text-center`;
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className={cell}>{index + 1}</TableCell>
                      <TableCell className={`${cell} font-medium`}>{admin.name}</TableCell>
                      <TableCell className={cell}>{admin.email}</TableCell>
                      <TableCell className={cell}>
                        <StatusBadge status={admin.enabled ? "active" : "disabled"} label={admin.enabled ? undefined : "Inactive"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
