import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthSplit } from "@/components/auth-split";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { Button } from "@/components/ui/button";
import { homeForRoles } from "@/lib/access";
import { auth, signIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  Configuration: "Sign-in is not configured. Check the Keycloak settings.",
  AccessDenied: "Keycloak denied this sign-in.",
  OAuthSignin: "Could not start the Keycloak sign-in.",
  OAuthCallback: "Keycloak did not finish signing you in.",
  OAuthAccountNotLinked: "This email is already used by another sign-in.",
  Default: "Sign-in failed. Try again.",
};

async function startKeycloakSignIn() {
  "use server";
  await signIn("keycloak", { redirectTo: "/login" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (session?.sub && session.roles.length > 0 && !params.error) {
    redirect(homeForRoles(session.roles));
  }

  const error = params.error ? (errorMessages[params.error] ?? errorMessages.Default) : null;

  return (
    <AuthSplit>
      <h4 className="mb-3 font-semibold">Sign in to your account</h4>
      <p className="mb-8 text-lg text-neutral-500 dark:text-neutral-300">
        There is one sign-in. After Keycloak accepts the account, the workspace changes to match it.
      </p>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <AutoSubmitForm action={startKeycloakSignIn}>
        <Button type="submit" className="w-full">
          Continue to Keycloak
        </Button>
      </AutoSubmitForm>
    </AuthSplit>
  );
}
