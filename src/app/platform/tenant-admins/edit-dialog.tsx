"use client";

import { Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useActionState } from "react";

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
import { SearchableSelect } from "@/components/ui/searchable-select";

import { updateTenantAdminAction, type TenantAdminEditState } from "./actions";

const emptyState: TenantAdminEditState = { error: null, saved: false };

export function EditTenantAdminDialog({
  userId,
  tenant,
  name,
  email,
  enabled,
  createdAt,
}: {
  userId: string;
  tenant: string;
  name: string;
  email: string;
  enabled: boolean;
  createdAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((key) => key + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={`Edit ${name}`}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit admin</DialogTitle>
          <DialogDescription className="sr-only">Name and status can be updated.</DialogDescription>
        </DialogHeader>
        {open ? (
          <EditAdminForm
            key={formKey}
            userId={userId}
            tenant={tenant}
            name={name}
            email={email}
            status={enabled ? "active" : "disabled"}
            createdAt={createdAt}
            onSaved={close}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditAdminForm({
  userId,
  tenant,
  name,
  email,
  status,
  createdAt,
  onSaved,
}: {
  userId: string;
  tenant: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  createdAt: string | null;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateTenantAdminAction, emptyState);

  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="tenant" value={tenant} />
      <label className="grid gap-2 text-sm font-medium">
        Name
        <Input name="name" required maxLength={120} defaultValue={name} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Email
        <Input value={email} disabled readOnly />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Status
        <SearchableSelect
          name="status"
          ariaLabel="Status"
          required
          defaultValue={status}
          options={[
            { value: "active", label: "Active" },
            { value: "disabled", label: "Inactive" },
          ]}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Created
        <Input value={createdAt ?? ""} disabled readOnly />
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
