"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { CourseStatus } from "@/lib/domain";

const initial = { error: null as string | null };

export function CourseStatusForm({
  courseId,
  status,
  action,
}: {
  courseId: string;
  status: CourseStatus;
  action: (previous: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const nextStatus: CourseStatus = status === "active" ? "archived" : "active";

  return (
    <form action={formAction}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" size="sm" variant={nextStatus === "archived" ? "destructive" : "outline"} disabled={pending}>
        {pending ? "Saving…" : nextStatus === "archived" ? "Archive" : "Restore"}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
