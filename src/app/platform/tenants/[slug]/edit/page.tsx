import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { getPlatformModels } from "@/lib/db";
import { TENANT_STATUSES } from "@/lib/domain";
import { readChoice, readPage, readText, withListQuery } from "@/lib/list-search";
import { requireRole } from "@/lib/rbac";
import { assertValidSlug, TenantSlugError } from "@/lib/tenant";

import { updateTenantAction } from "../../actions";
import { TenantEditForm } from "../../edit-form";

export const metadata: Metadata = {
  title: "Edit organization",
};

export const dynamic = "force-dynamic";

export default async function EditTenantPage({
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
  const tenant = await Tenant.findOne({ tenant: safe }).select("name tenant status").lean();
  if (!tenant) notFound();

  return (
    <>
      <DashboardBreadcrumb
        title="Edit organization"
        text="Tenants"
        nav="super_admin"
        backHref={withListQuery("/platform/tenants", {
          q: readText(query.q),
          status: readChoice(query.status, TENANT_STATUSES),
          page: readPage(query.page),
        })}
      />
      <div className="flex flex-wrap items-start justify-center gap-4">
        <div className="card w-full max-w-md !h-auto">
          <TenantEditForm tenant={tenant.tenant} name={tenant.name} status={tenant.status} action={updateTenantAction} />
        </div>
      </div>
    </>
  );
}
