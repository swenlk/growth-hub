import type { Metadata } from "next";

import { AddTenantAdminDialog } from "@/app/platform/tenant-admins/add-dialog";
import { EditTenantAdminDialog } from "@/app/platform/tenant-admins/edit-dialog";
import { ListPager } from "@/components/dashboard/list-pager";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformModels } from "@/lib/db";
import { KeycloakAdminError, listTenantAdmins, type TenantAdminAccount } from "@/lib/keycloak-admin";
import { readPage, readText, withListQuery } from "@/lib/list-search";
import { requireRole } from "@/lib/rbac";
import { assertValidSlug, TenantSlugError } from "@/lib/tenant";

const pageSize = 10;

function adminListHref(tenant: string, page: number) {
  return withListQuery("/platform/tenant-admins", { tenant, page: page > 1 ? page : 0 });
}

export const metadata: Metadata = {
  title: "Tenant admins",
};

export const dynamic = "force-dynamic";

export default async function TenantAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; page?: string }>;
}) {
  await requireRole("super_admin");
  const { Tenant } = await getPlatformModels();
  const query = await searchParams;
  const requestedTenant = readText(query.tenant, 30);
  let tenantId = "";
  try {
    tenantId = requestedTenant ? assertValidSlug(requestedTenant) : "";
  } catch (error) {
    if (!(error instanceof TenantSlugError)) throw error;
  }

  const organizations = await Tenant.find().sort({ name: 1 }).select("name tenant").lean();
  const organization = tenantId ? organizations.find((item) => item.tenant === tenantId) : undefined;

  let admins: TenantAdminAccount[] = [];
  let adminError: string | null = null;
  if (organization) {
    try {
      admins = await listTenantAdmins(organization.tenant);
    } catch (error) {
      if (error instanceof KeycloakAdminError) {
        adminError = "Tenant admins could not be loaded.";
      } else {
        throw error;
      }
    }
  }

  const searched = Boolean(organization);
  const total = admins.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = readPage(query.page);
  const page = requested > 0 ? Math.min(requested, pageCount) : 1;
  const visible = admins.slice((page - 1) * pageSize, page * pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + visible.length;
  const head = `${headCell} !text-center`;

  return (
    <>
      <DashboardBreadcrumb
        title="Tenant admins"
        text="Tenant admins"
        nav="super_admin"
        hint="Choose an organization, then search to see its admins."
      />
      <div className="card flex flex-1 flex-col !h-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <SearchableSelect
              name="tenant"
              ariaLabel="Organization"
              defaultValue={organization?.tenant ?? ""}
              className="min-w-56"
              options={[
                { value: "", label: "Select organization" },
                ...organizations.map((item) => ({ value: item.tenant, label: item.name })),
              ]}
            />
            <Button type="submit">Search</Button>
          </form>
          <AddTenantAdminDialog
            organizations={organizations.map((item) => ({ value: item.tenant, label: item.name }))}
            defaultTenant={organization?.tenant ?? ""}
          />
        </div>
        {adminError ? (
          <p className="text-sm text-destructive">{adminError}</p>
        ) : !organization || visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            {organization ? "No tenant admins for this organization." : "Select an organization, then search."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={head}>#</TableHead>
                <TableHead className={head}>Name</TableHead>
                <TableHead className={head}>Email</TableHead>
                <TableHead className={head}>Organization</TableHead>
                <TableHead className={head}>Status</TableHead>
                <TableHead className={head}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((admin, index) => {
                const cell = `${lastBodyCell(index === visible.length - 1)} !text-center`;
                return (
                  <TableRow key={admin.id}>
                    <TableCell className={cell}>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className={`${cell} font-medium`}>{admin.name}</TableCell>
                    <TableCell className={cell}>{admin.email}</TableCell>
                    <TableCell className={cell}>{organization.name}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge
                        status={admin.enabled ? "active" : "disabled"}
                        label={admin.enabled ? undefined : "Inactive"}
                      />
                    </TableCell>
                    <TableCell className={cell}>
                      <div className="flex justify-center">
                        <EditTenantAdminDialog
                          userId={admin.id}
                          tenant={organization.tenant}
                          name={admin.name}
                          email={admin.email}
                          enabled={admin.enabled}
                          createdAt={admin.createdAt}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {searched ? (
          <ListPager
            page={page}
            pageCount={pageCount}
            total={total}
            start={start}
            end={end}
            hrefFor={(number) => adminListHref(organization?.tenant ?? "", number)}
          />
        ) : null}
      </div>
    </>
  );
}
