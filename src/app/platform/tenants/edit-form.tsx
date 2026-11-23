"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { TenantStatus } from "@/lib/domain";

import type { TenantEditState } from "./actions";

const emptyState: TenantEditState = { error: null, saved: false };

export function TenantEditForm({
  tenant,
  name,
  status,
  action,
}: {
  tenant: string;
  name: string;
  status: TenantStatus;
  action: (previous: TenantEditState, formData: FormData) => Promise<TenantEditState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tenant" value={tenant} />
      <div className="space-y-4">
        <label className="grid gap-2 text-sm font-medium">
          Organization name
          <Input name="name" required maxLength={120} defaultValue={name} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Tenant
          <Input value={tenant} disabled readOnly />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Status
          <SearchableSelect
            name="status"
            ariaLabel="Status"
            defaultValue={status}
            options={[
              { value: "active", label: "Active" },
              { value: "disabled", label: "Inactive" },
            ]}
          />
        </label>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-neutral-600 dark:text-neutral-300">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
