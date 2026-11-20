import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChartPie, ClipboardList, UsersRound } from "lucide-react";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { getTenantContext, requireRole } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const { Course, Staff } = models;

  const [staffCount, courseCount, assignmentRows] = await Promise.all([
    Staff.countDocuments(),
    Course.countDocuments(),
    Staff.aggregate<{ total: number; completed: number }>([
      { $unwind: "$assignments" },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$assignments.status", "completed"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const assignments = assignmentRows[0]?.total ?? 0;
  const completed = assignmentRows[0]?.completed ?? 0;
  const completion = assignments === 0 ? "-" : `${Math.round((completed / assignments) * 100)}%`;
  const counts = [
    { label: "Staff", value: String(staffCount), hint: "People who can sign in", href: "/admin/staff", icon: UsersRound, iconBg: "bg-cyan-600", gradientFrom: "from-cyan-600/10" },
    { label: "Courses", value: String(courseCount), hint: "Videos ready to assign", href: "/admin/courses", icon: BookOpen, iconBg: "bg-purple-600", gradientFrom: "from-purple-600/10" },
    { label: "Assignments", value: String(assignments), hint: "Courses given to staff", href: "/admin/assignments", icon: ClipboardList, iconBg: "bg-primary", gradientFrom: "from-primary/10" },
    { label: "Completion", value: completion, hint: "Assignments marked finished", href: "", icon: ChartPie, iconBg: "bg-green-600", gradientFrom: "from-green-600/10" },
  ];

  return (
    <>
      <DashboardBreadcrumb title="Dashboard" text="Overview" hint="Open a number to work with that list." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map((card) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{card.label}</p>
                  <h3 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{card.value}</h3>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.iconBg}`}>
                  <card.icon className="text-white" size={24} />
                </div>
              </div>
              <p className="mt-4 text-[13px] text-neutral-500 dark:text-neutral-400">{card.hint}</p>
            </>
          );
          const className = `block rounded-md border border-gray-200 bg-gradient-to-r ${card.gradientFrom} to-white p-4 shadow-none dark:border-neutral-700 dark:to-slate-700`;
          return card.href ? (
            <Link key={card.label} href={card.href} className={`${className} transition hover:border-primary/40`}>
              {body}
            </Link>
          ) : (
            <div key={card.label} className={className}>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}
