"use client";

import Footer from "@/components/layout/footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/domain";

import { DashboardHeader } from "./header";
import { DashboardSidebar } from "./sidebar";

export function DashboardShell({
  role,
  name,
  defaultOpen,
  children,
}: {
  role: AppRole;
  name?: string | null;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <DashboardSidebar role={role} />
      <main className="dashboard-body-wrapper grow-[1] flex flex-col">
        <SidebarInset>
          <DashboardHeader role={role} name={name} />
        </SidebarInset>
        <div className="dashboard-body bg-neutral-100 dark:bg-[#1e2734] md:p-4 p-3 flex-1">{children}</div>
        <Footer />
      </main>
    </SidebarProvider>
  );
}
