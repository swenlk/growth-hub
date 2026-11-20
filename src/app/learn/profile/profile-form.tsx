"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ProfilePasswordState } from "./actions";

const emptyState: ProfilePasswordState = { error: null, saved: false };

export function ProfileForm({
  name,
  email,
  action,
}: {
  name: string;
  email: string;
  action: (previous: ProfilePasswordState, formData: FormData) => Promise<ProfilePasswordState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state.saved]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <label className="grid gap-2 text-sm font-medium">
        <span className="flex h-6 items-center">Name</span>
        <Input value={name} disabled readOnly />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        <span className="flex h-6 items-center">Email</span>
        <Input type="email" value={email} disabled readOnly />
      </label>
      <PasswordField name="newPassword" label="New password" autoComplete="new-password" minLength={8} />
      <PasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" minLength={8} />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-neutral-600 dark:text-neutral-300">Password updated.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-2 text-sm font-medium">
      <span className="flex h-6 items-center">{label}</span>
      <div className="relative">
        <Input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={128}
          autoComplete={autoComplete}
          className="pr-8"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </label>
  );
}
