import { DashboardFrame } from "@/components/dashboard/frame";
import { auth } from "@/lib/auth";
import { redirectInactiveOrganization } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  await redirectInactiveOrganization();
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email;

  return (
    <DashboardFrame role="staff" name={name}>
      {children}
    </DashboardFrame>
  );
}
