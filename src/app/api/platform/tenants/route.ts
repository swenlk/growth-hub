import { AuthzError, requireRole } from "@/lib/rbac";
import { createTenantWithAdmin, TenantSetupError } from "@/lib/tenants";
import { createTenantSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireRole("super_admin");
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Check the form" }, { status: 400 });
  }

  const parsed = createTenantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  }

  try {
    const created = await createTenantWithAdmin(parsed.data);
    return Response.json(
      {
        name: created.name,
        tenant: created.tenant,
        email: created.email,
        temporaryPassword: created.temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TenantSetupError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Tenant create failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "The organization could not be created" }, { status: 500 });
  }
}
