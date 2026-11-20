import {
  BookOpen,
  Building2,
  // ChartPie,
  ClipboardList,
  GraduationCap,
  House,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/domain";

export type DashNavItem = {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  label?: string;
};

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Platform",
  tenant_admin: "Tenant admin",
  staff: "Staff",
};

export const NAV: Record<AppRole, DashNavItem[]> = {
  super_admin: [{ title: "Tenants", url: "/platform/tenants", icon: Building2 }],
  tenant_admin: [
    { title: "Dashboard", url: "/admin", icon: House },
    { label: "Workspace" },
    { title: "Staff", url: "/admin/staff", icon: UsersRound },
    { title: "Courses", url: "/admin/courses", icon: BookOpen },
    { title: "Assignments", url: "/admin/assignments", icon: ClipboardList },
    // { title: "Reports", url: "/admin/reports", icon: ChartPie },
    { title: "Profile", url: "/admin/profile", icon: UserRound },
  ],
  staff: [
    { title: "My training", url: "/learn", icon: GraduationCap },
    { title: "Profile", url: "/learn/profile", icon: UserRound },
  ],
};
