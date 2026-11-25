"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useActionState } from "react";

import { AccountCreated } from "@/components/account-created";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { emptyAccountFormState, type AccountFormState } from "@/lib/form-state";

import { addTenantAdminAction } from "./actions";

type CreatedAccount = NonNullable<AccountFormState["created"]>;

export function AddTenantAdminDialog({
  organizations,
  defaultTenant,
}: {
  organizations: SearchableOption[];
  defaultTenant: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const remember = useCallback((account: CreatedAccount) => setCreated(account), []);

  function handleOpenChange(next: boolean) {
    if (!next && created) router.refresh();
    if (next) setFormKey((key) => key + 1);
    if (!next) setCreated(null);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">Add admin</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add admin</DialogTitle>
          <DialogDescription className="sr-only">Choose an organization, then set the name and email.</DialogDescription>
        </DialogHeader>
        {open && created ? (
          <div className="space-y-4">
            <AccountCreated email={created.email} temporaryPassword={created.temporaryPassword} />
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : null}
        {open && !created ? (
          <AddAdminForm
            key={formKey}
            organizations={organizations}
            defaultTenant={defaultTenant}
            onCreated={remember}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddAdminForm({
  organizations,
  defaultTenant,
  onCreated,
}: {
  organizations: SearchableOption[];
  defaultTenant: string;
  onCreated: (account: CreatedAccount) => void;
}) {
  const [state, formAction, pending] = useActionState(addTenantAdminAction, emptyAccountFormState);

  useEffect(() => {
    if (state.created) onCreated(state.created);
  }, [state.created, onCreated]);

  return (
    <form action={formAction} className="space-y-4">
      <label className="grid gap-2 text-sm font-medium">
        Organization
        <SearchableSelect
          name="tenant"
          ariaLabel="Organization"
          required
          defaultValue={defaultTenant}
          placeholder="Select organization"
          options={[{ value: "", label: "Select organization" }, ...organizations]}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Name
        <Input name="name" required maxLength={120} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Email
        <Input name="email" type="email" required maxLength={254} />
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add admin"}
        </Button>
      </DialogFooter>
    </form>
  );
}
