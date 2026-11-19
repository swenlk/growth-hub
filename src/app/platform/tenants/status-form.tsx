"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { TenantStatus } from "@/lib/domain";

const initial = { error: null as string | null };

export function TenantStatusForm({
  slug,
  status,
  action,
}: {
  slug: string;
  status: TenantStatus;
  action: (previous: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const nextStatus: TenantStatus = status === "active" ? "disabled" : "active";

  return (
    <form action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" size="sm" variant={nextStatus === "disabled" ? "destructive" : "outline"} disabled={pending}>
        {pending ? "Saving…" : nextStatus === "disabled" ? "Disable" : "Enable"}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
