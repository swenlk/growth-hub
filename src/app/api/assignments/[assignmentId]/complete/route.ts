import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getTenantContext } from "@/lib/rbac";
import { recordCompletion, watchErrorResponse } from "@/lib/watch-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await context.params;
    if (!z.string().uuid().safeParse(assignmentId).success) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }
    const ctx = await getTenantContext();
    if (!ctx.session.roles.includes("staff")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const view = await recordCompletion(ctx, assignmentId);
    revalidatePath("/learn");
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/assignments");
    return Response.json(view);
  } catch (error) {
    return watchErrorResponse(error);
  }
}
