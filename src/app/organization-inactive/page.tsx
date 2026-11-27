import type { Metadata } from "next";

import { AuthSplit } from "@/components/auth-split";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Organization disabled",
};

export default function OrganizationInactivePage() {
  return (
    <AuthSplit>
      <h4 className="mb-3 font-semibold">Your organization is disabled</h4>
      <p className="mb-8 text-lg text-neutral-500 dark:text-neutral-300">
        This account cannot open the workspace until a platform administrator enables the organization.
      </p>
      <form action="/api/auth/keycloak-signout" method="post">
        <input type="hidden" name="returnTo" value="/login" />
        <Button type="submit" className="px-6">
          Back to login
        </Button>
      </form>
    </AuthSplit>
  );
}
