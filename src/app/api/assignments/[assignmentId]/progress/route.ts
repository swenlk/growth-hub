import { z } from "zod";

import { recordHeartbeat, watchErrorResponse } from "@/lib/watch-progress";
import { getTenantContext } from "@/lib/rbac";
import { progressHeartbeatSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await context.params;
    if (!z.string().uuid().safeParse(assignmentId).success) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }
    const ctx = await getTenantContext();
    if (!ctx.session.roles.includes("staff")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = progressHeartbeatSchema.parse(await request.json());
    return Response.json(await recordHeartbeat(ctx, assignmentId, body));
  } catch (error) {
    return watchErrorResponse(error);
  }
}
