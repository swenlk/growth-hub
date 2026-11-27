import { trainingListResponse } from "@/lib/training-list";
import type { AssignmentStatus } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: Record<string, AssignmentStatus> = {
  "not-started": "assigned",
  "in-progress": "in_progress",
  completed: "completed",
};

export async function GET(_request: Request, context: { params: Promise<{ status: string }> }) {
  const { status } = await context.params;
  const assignmentStatus = STATUSES[status];
  if (!assignmentStatus) {
    return Response.json({ error: "Training list not found" }, { status: 404 });
  }
  return trainingListResponse(assignmentStatus);
}
