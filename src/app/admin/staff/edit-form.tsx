"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { StaffStatus } from "@/lib/domain";

import type { StaffEditState } from "./actions";

const emptyState: StaffEditState = { error: null, saved: false };
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

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
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

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
        <div className="grid gap-2 text-sm font-medium">
          <div className="flex h-6 items-center justify-between gap-2">
            <span>Set password</span>
            <Button
              type="button"
              variant="outline"
              className="h-6 px-2.5 text-xs"
              onClick={() => {
                setPassword(generatePassword());
                setCopied(false);
              }}
            >
              Generate
            </Button>
          </div>
          <div className="relative">
            <Input
              name="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setCopied(false);
              }}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
              aria-label="Set password"
              className="pr-8"
            />
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy password"}
              onClick={() => void copyPassword()}
              disabled={password.length === 0}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 disabled:opacity-40 dark:hover:text-neutral-100"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-neutral-600 dark:text-neutral-300">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
