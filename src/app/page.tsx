import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthSplit } from "@/components/auth-split";
import { Button } from "@/components/ui/button";
import { homeForRoles } from "@/lib/access";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (session?.sub && session.roles.length > 0) {
    redirect(homeForRoles(session.roles));
  }

  return (
    <AuthSplit>
      <h4 className="mb-3 font-semibold">Staff training, one tenant at a time</h4>
      <p className="mb-8 text-lg text-neutral-500 dark:text-neutral-300">
        Everyone uses the same sign-in. After you sign in, the workspace matches your account:
        platform, organization admin, or learning.
      </p>
      <Button asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    </AuthSplit>
  );
}
