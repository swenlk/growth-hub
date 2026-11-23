import { AuthzError, requireRole } from "@/lib/rbac";
import { setTenantStatus, TenantSetupError } from "@/lib/tenants";
import { updateTenantStatusSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await requireRole("super_admin");
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That update is not valid" }, { status: 400 });
  }

  const parsed = updateTenantStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "That update is not valid" }, { status: 400 });
  }

  try {
    await setTenantStatus(slug, parsed.data.status);
    return Response.json({ tenant: slug, status: parsed.data.status });
  } catch (error) {
    if (error instanceof TenantSetupError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Tenant status update failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "The organization could not be updated" }, { status: 500 });
  }
}
