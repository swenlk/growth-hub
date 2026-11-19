"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import LogoSidebar from "@/components/shared/logo-sidebar";
import type { AppRole } from "@/lib/domain";

import { NAV } from "./nav";

export function DashboardSidebar({ role }: { role: AppRole }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <LogoSidebar />
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
        <NavMain items={NAV[role]} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
