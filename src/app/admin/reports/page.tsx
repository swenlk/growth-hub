import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <Placeholder title="Reports" empty="No assignment rows yet.">
      <p>
        Filter assignments by completed, not completed, or overdue. Watched percent comes from
        merged playback ranges, not from the playhead position alone.
      </p>
    </Placeholder>
  );
}
