"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StaffStatus } from "@/lib/domain";

import type { StaffEditState } from "./actions";

const selectClass =
  "border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
    <form action={formAction} className="max-w-3xl space-y-4">
      <input type="hidden" name="staffId" value={staffId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          Name
          <Input name="name" required maxLength={120} defaultValue={name} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <Input name="email" type="email" value={email} disabled readOnly />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Status
          <select name="status" defaultValue={status} className={selectClass}>
            <option value="active">Active</option>
            <option value="disabled">Inactive</option>
          </select>
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
