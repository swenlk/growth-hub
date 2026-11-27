import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";

import { ListPager } from "@/components/dashboard/list-pager";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { headCell, lastBodyCell } from "@/components/dashboard/table-styles";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformModels } from "@/lib/db";
import { TENANT_STATUSES, type TenantStatus } from "@/lib/domain";
import { readChoice, readText, withListQuery } from "@/lib/list-search";
import { requireRole } from "@/lib/rbac";

const pageSize = 10;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tenantListHref(search: { q: string; status: TenantStatus | ""; page: number }, path = "/platform/tenants") {
  return withListQuery(path, { q: search.q, status: search.status, page: search.page > 1 ? search.page : 0 });
}

export const metadata: Metadata = {
  title: "Tenants",
};

export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireRole("super_admin");
  const { Tenant } = await getPlatformModels();
  const query = await searchParams;
  const q = readText(query.q);
  const status = readChoice(query.status, TENANT_STATUSES);
  const requested = Number(query.page);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const pattern = escapeRegex(q);
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { tenant: { $regex: pattern, $options: "i" } },
    ];
  }
  const total = await Tenant.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  const tenants = await Tenant.find(filter)
    .sort({ createdDate: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + tenants.length;

  return (
    <>
      <DashboardBreadcrumb title="Tenants" text="Tenants" nav="super_admin" hint="Search by name or tenant, then open an organization to update it." />
      <div className="card flex flex-1 flex-col !h-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <Input name="q" defaultValue={q} placeholder="Name or tenant" aria-label="Search name or tenant" className="w-56" />
            <SearchableSelect
              name="status"
              ariaLabel="Status"
              defaultValue={status}
              className="min-w-40"
              options={[
                { value: "", label: "All status" },
                { value: "active", label: "Active" },
                { value: "disabled", label: "Inactive" },
              ]}
            />
            <Button type="submit">Search</Button>
          </form>
          <Button asChild>
            <Link href="/platform/tenants/new">Add organization</Link>
          </Button>
        </div>
        {tenants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            {q || status ? "No organizations match this search." : "No organizations yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`${headCell} !text-center`}>#</TableHead>
                <TableHead className={`${headCell} !text-center`}>Name</TableHead>
                <TableHead className={`${headCell} !text-center`}>Tenant</TableHead>
                <TableHead className={`${headCell} !text-center`}>Status</TableHead>
                <TableHead className={`${headCell} !text-center`}>Created</TableHead>
                <TableHead className={`${headCell} !text-center`}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant, index) => {
                const cell = `${lastBodyCell(index === tenants.length - 1)} !text-center`;
                const search = { q, status, page };
                return (
                  <TableRow key={String(tenant._id)}>
                    <TableCell className={cell}>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className={`${cell} font-medium`}>{tenant.name}</TableCell>
                    <TableCell className={cell}>{tenant.tenant}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={tenant.status} label={tenant.status === "disabled" ? "Inactive" : undefined} />
                    </TableCell>
                    <TableCell className={cell}>{tenant.createdDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className={cell}>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={tenantListHref(search, `/platform/tenants/${tenant.tenant}`)} aria-label={`View ${tenant.name}`}>
                            <Eye className="size-3.5" />
                            View
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={tenantListHref(search, `/platform/tenants/${tenant.tenant}/edit`)}
                            aria-label={`Edit ${tenant.name}`}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Link>
                        </Button>
                      </div>
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
          hrefFor={(number) => tenantListHref({ q, status, page: number })}
        />
      </div>
    </>
  );
}
