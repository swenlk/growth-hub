import type { Metadata } from "next";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { requireRole } from "@/lib/rbac";

import { TrainingTabs } from "./training-tabs";

export const metadata: Metadata = {
  title: "My training",
};

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  await requireRole("staff");

  return (
    <>
      <DashboardBreadcrumb title="My training" text="Assigned" />
      <TrainingTabs />
    </>
  );
}
