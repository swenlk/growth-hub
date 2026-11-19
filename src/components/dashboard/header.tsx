"use client";

import { ModeToggle } from "@/components/shared/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/domain";

import { ROLE_LABEL, searchLinks } from "./nav";
import { ProfileMenu } from "./profile-menu";
import { DashboardSearch } from "./search-box";

export function DashboardHeader({ role, name }: { role: AppRole; name?: string | null }) {
  return (
    <header className="dashboard-header flex items-center justify-between sm:h-16 h-12 shrink-0 gap-2 md:px-4 px-3 py-3 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-16 dark:bg-[#273142]">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ms-1 p-0 size-[unset] cursor-pointer" />
        <DashboardSearch items={searchLinks(role)} />
      </div>
      <div className="flex items-center gap-3">
        <ModeToggle />
        <ProfileMenu name={name} roleLabel={ROLE_LABEL[role]} />
      </div>
    </header>
  );
}
