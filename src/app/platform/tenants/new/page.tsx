import type { Metadata } from "next";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { requireRole } from "@/lib/rbac";

import { createTenantAction } from "../actions";
import { TenantCreateForm } from "../tenant-form";

export const metadata: Metadata = {
  title: "Add organization",
};

export const dynamic = "force-dynamic";

export default async function NewTenantPage() {
  await requireRole("super_admin");

  return (
    <>
      <DashboardBreadcrumb title="Add organization" text="Organizations" backHref="/platform/tenants" />
      <div className="card mx-auto w-full max-w-md !h-auto">
        <TenantCreateForm action={createTenantAction} />
      </div>
    </>
  );
}
