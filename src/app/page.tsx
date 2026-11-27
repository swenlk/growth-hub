import { redirect } from "next/navigation";

import { AutoSubmitForm } from "@/components/auto-submit-form";
import { homeForRoles } from "@/lib/access";
import { auth, signIn } from "@/lib/auth";
import { redirectInactiveOrganization } from "@/lib/rbac";

export const dynamic = "force-dynamic";

async function startKeycloakSignIn() {
  "use server";
  await signIn("keycloak", { redirectTo: "/" });
}

export default async function HomePage() {
  const session = await auth();
  if (session?.sub && session.roles.length > 0) {
    await redirectInactiveOrganization();
    redirect(homeForRoles(session.roles));
  }

  return (
    <AutoSubmitForm action={startKeycloakSignIn}>
      <p>Redirecting to sign in…</p>
    </AutoSubmitForm>
  );
}
