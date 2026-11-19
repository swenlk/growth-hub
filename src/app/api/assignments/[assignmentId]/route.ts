import { readAssignment, watchErrorResponse } from "@/lib/watch-progress";
import { getTenantContext } from "@/lib/rbac";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await context.params;
    if (!z.string().uuid().safeParse(assignmentId).success) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }
    const ctx = await getTenantContext();
    if (!ctx.session.roles.includes("staff")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.json(await readAssignment(ctx, assignmentId));
  } catch (error) {
    return watchErrorResponse(error);
  }
}
