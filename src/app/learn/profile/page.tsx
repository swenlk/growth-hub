import type { Metadata } from "next";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { getTenantContext, requireRole } from "@/lib/rbac";

import { changeOwnPasswordAction } from "./actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireRole("staff");
  const { models, session } = await getTenantContext();
  const person = await models.Staff.findOne({ keycloakUserId: session.sub }).select("name email").lean();

  return (
    <>
      <DashboardBreadcrumb title="Profile" text="Profile" nav="staff" hint="Your sign-in name and email. Set a new password when you want one." />
      <div className="card mx-auto w-full max-w-md !h-auto">
        {person ? (
          <ProfileForm name={person.name} email={person.email} action={changeOwnPasswordAction} />
        ) : (
          <p className="text-center text-sm text-neutral-500">Your profile is not in this organization.</p>
        )}
      </div>
    </>
  );
}
