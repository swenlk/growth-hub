import type { Metadata } from "next";

import { ProfileForm } from "@/app/learn/profile/profile-form";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { KeycloakAdminError, readSignInAccount } from "@/lib/keycloak-admin";
import { getTenantContext, requireRole } from "@/lib/rbac";

import { changeAdminPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "Profile",
};

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  await requireRole("tenant_admin");
  const { session } = await getTenantContext();

  let account: { name: string; email: string } | null = null;
  try {
    account = await readSignInAccount(session.sub);
  } catch (error) {
    if (!(error instanceof KeycloakAdminError) || error.status !== 404) throw error;
  }

  return (
    <>
      <DashboardBreadcrumb
        title="Profile"
        text="Account"
        hint="Your sign-in name and email. Set a new password when you want one."
      />
      <div className="card mx-auto w-full max-w-md !h-auto">
        {account ? (
          <ProfileForm name={account.name} email={account.email} action={changeAdminPasswordAction} />
        ) : (
          <p className="text-center text-sm text-neutral-500">Your profile was not found.</p>
        )}
      </div>
    </>
  );
}
