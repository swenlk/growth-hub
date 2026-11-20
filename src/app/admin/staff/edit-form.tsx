"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { StaffStatus } from "@/lib/domain";

import type { StaffEditState } from "./actions";

const emptyState: StaffEditState = { error: null, saved: false };

export function StaffEditForm({
  staffId,
  name,
  email,
  status,
  action,
}: {
  staffId: string;
  name: string;
  email: string;
  status: StaffStatus;
  action: (previous: StaffEditState, formData: FormData) => Promise<StaffEditState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="staffId" value={staffId} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Name</span>
          <Input name="name" required maxLength={120} defaultValue={name} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Email</span>
          <Input name="email" type="email" value={email} disabled readOnly />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Status</span>
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
