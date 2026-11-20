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
import type { StaffStatus } from "@/lib/domain";
import { readChoice, readText, withListQuery } from "@/lib/list-search";
import { getTenantContext, requireRole } from "@/lib/rbac";

const pageSize = 10;
const STAFF_STATUSES = ["active", "disabled"] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function staffListHref(search: { q: string; status: StaffStatus | ""; page: number }, path = "/admin/staff") {
  return withListQuery(path, { q: search.q, status: search.status, page: search.page > 1 ? search.page : 0 });
}

export const metadata: Metadata = {
  title: "Staff",
};

export const dynamic = "force-dynamic";

export default async function StaffListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const query = await searchParams;
  const q = readText(query.q);
  const status = readChoice(query.status, STAFF_STATUSES);
  const requested = Number(query.page);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const pattern = escapeRegex(q);
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
    ];
  }
  const total = await models.Staff.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  const staff = await models.Staff.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + staff.length;

  return (
    <>
      <DashboardBreadcrumb title="Staff" text="Directory" hint="Search by name or email, then open a person to update them." />
      <div className="card flex flex-1 flex-col !h-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <Input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search name or email" className="w-56" />
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
            <Link href="/admin/staff/new">Add staff</Link>
          </Button>
        </div>
        {staff.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
            {q || status ? "No staff match this search." : "No staff yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>#</TableHead>
                <TableHead className={headCell}>Name</TableHead>
                <TableHead className={headCell}>Email</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={headCell}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((person, index) => {
                const cell = lastBodyCell(index === staff.length - 1);
                return (
                  <TableRow key={String(person._id)}>
                    <TableCell className={cell}>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className={`${cell} font-medium`}>{person.name}</TableCell>
                    <TableCell className={cell}>{person.email}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge status={person.status} label={person.status === "disabled" ? "Inactive" : undefined} />
                    </TableCell>
                    <TableCell className={cell}>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={staffListHref({ q, status, page }, `/admin/staff/${person._id.toString()}/edit`)}
                          aria-label={`Edit ${person.name}`}
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
          hrefFor={(number) => staffListHref({ q, status, page: number })}
        />
      </div>
    </>
  );
}
