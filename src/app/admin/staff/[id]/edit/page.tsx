import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { getTenantContext, requireRole } from "@/lib/rbac";
import { objectIdSchema } from "@/lib/validators";

import { updateStaffAction } from "../../actions";
import { StaffEditForm } from "../../edit-form";

export const metadata: Metadata = {
  title: "Edit staff",
};

export const dynamic = "force-dynamic";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const person = await models.Staff.findById(id).select("name email status").lean();
  if (!person) notFound();

  return (
    <>
      <DashboardBreadcrumb title="Edit staff" text="Directory" />
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
