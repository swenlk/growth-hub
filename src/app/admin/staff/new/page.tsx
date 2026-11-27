import type { Metadata } from "next";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { requireRole } from "@/lib/rbac";

import { createStaffAction } from "../actions";
import { StaffCreateForm } from "../staff-form";

export const metadata: Metadata = {
  title: "Add staff",
};

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
  await requireRole("tenant_admin");

  return (
    <>
      <DashboardBreadcrumb title="Add staff" text="Staff" hint="They receive an email address and a temporary password." backHref="/admin/staff" />
      <div className="card !h-auto">
        <StaffCreateForm action={createStaffAction} />
      </div>
    </>
  );
}
