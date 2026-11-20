import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import type { StaffStatus } from "@/lib/domain";
import { readChoice, readPage, readText, withListQuery } from "@/lib/list-search";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

import { updateStaffAction } from "../../actions";
import { StaffEditForm } from "../../edit-form";

export const metadata: Metadata = {
  title: "Edit staff",
};

export const dynamic = "force-dynamic";

const STAFF_STATUSES = ["active", "disabled"] as const satisfies readonly StaffStatus[];

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const person = await models.Staff.findById(id).select("name email status").lean();
  if (!person) notFound();

  return (
    <>
      <DashboardBreadcrumb
        title="Edit staff"
        text="Directory"
        backHref={withListQuery("/admin/staff", {
          q: readText(query.q),
          status: readChoice(query.status, STAFF_STATUSES),
          page: readPage(query.page),
        })}
      />
      <div className="card !h-auto">
        <StaffEditForm
          staffId={id}
          name={person.name}
          email={person.email}
          status={person.status}
          action={updateStaffAction}
        />
      </div>
    </>
  );
}
