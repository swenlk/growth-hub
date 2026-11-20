"use client";

import { useActionState } from "react";

import { AccountCreated } from "@/components/account-created";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyAccountFormState, type AccountFormState } from "@/lib/form-state";

export function TenantCreateForm({
  action,
}: {
  action: (previous: AccountFormState, formData: FormData) => Promise<AccountFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyAccountFormState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="grid gap-2 text-sm font-medium">
        Organization name
        <Input name="name" required maxLength={120} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Slug
        <Input name="slug" required maxLength={30} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
        <span className="text-xs font-normal text-neutral-500 dark:text-neutral-300">
          Lowercase letters, numbers, and hyphens.
        </span>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Admin name
        <Input name="adminName" required maxLength={120} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Admin email
        <Input name="adminEmail" type="email" required maxLength={254} />
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.created ? (
        <AccountCreated email={state.created.email} temporaryPassword={state.created.temporaryPassword} />
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
