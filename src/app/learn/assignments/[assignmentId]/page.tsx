import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Assignment",
};

export default async function AssignmentPlayerPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  return (
    <Placeholder title="Watch and complete">
      <p>
        Assignment <span className="font-mono">{assignmentId}</span>. The player will
        resume at the last saved position. Seeking does not count as watched.
      </p>
      <div className="mt-2 overflow-hidden rounded-lg bg-neutral-950">
        <div className="flex aspect-video items-center justify-center text-sm text-neutral-400">
          Video player
        </div>
      </div>
      <Button type="button" disabled>
        Mark as completed
      </Button>
      <p className="text-xs text-neutral-500">Available after the video has been fully watched.</p>
    </Placeholder>
  );
}
