import type { Metadata } from "next";
import Link from "next/link";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "My training",
};

export default function LearnPage() {
  return (
    <>
      <DashboardBreadcrumb title="My training" text="Assigned" />
      <Placeholder title="Assigned" heading="section" empty="Nothing assigned.">
        <p>Courses that are assigned or in progress, with due dates and watched percent.</p>
        <p>
          <Link href="/learn/assignments/example" className="font-medium text-primary">
            Open the video player
          </Link>
        </p>
      </Placeholder>
      <Placeholder title="Completed" heading="section" empty="No completed courses.">
        <p>Finished assignments, each with its own completion date.</p>
      </Placeholder>
    </>
  );
}
