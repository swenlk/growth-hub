"use client";

import { useActionState } from "react";

import { AccountCreated } from "@/components/account-created";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyAccountFormState, type AccountFormState } from "@/lib/form-state";

export function StaffCreateForm({
  action,
}: {
  action: (previous: AccountFormState, formData: FormData) => Promise<AccountFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyAccountFormState);

  return (
    <form action={formAction} className="max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Name
          <Input name="name" required maxLength={120} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <Input name="email" type="email" required maxLength={254} />
        </label>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.created ? (
        <AccountCreated email={state.created.email} temporaryPassword={state.created.temporaryPassword} />
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add staff"}
      </Button>
    </form>
  );
}
