import { cookies } from "next/headers";

import type { AppRole } from "@/lib/domain";

import { DashboardShell } from "./shell";

export async function DashboardFrame({
  role,
  name,
  children,
}: {
  role: AppRole;
  name?: string | null;
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <DashboardShell role={role} name={name} defaultOpen={defaultOpen}>
      {children}
    </DashboardShell>
  );
}
