import { DashboardFrame } from "@/components/dashboard/frame";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email;

  return (
    <DashboardFrame role="tenant_admin" name={name}>
      {children}
    </DashboardFrame>
  );
}
