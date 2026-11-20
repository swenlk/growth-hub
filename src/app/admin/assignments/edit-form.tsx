"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { assignmentStatusLabel } from "@/lib/assignment-view";
import type { AssignmentStatus } from "@/lib/domain";

import type { AssignmentEditState } from "./actions";

const emptyState: AssignmentEditState = { error: null, saved: false };

const STATUSES: AssignmentStatus[] = ["assigned", "in_progress", "completed"];

export function AssignmentEditForm({
  assignmentId,
  staffId,
  courseId,
  dueDate,
  status,
  staff,
  courses,
  action,
}: {
  assignmentId: string;
  staffId: string;
  courseId: string;
  dueDate: string;
  status: AssignmentStatus;
  staff: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  action: (previous: AssignmentEditState, formData: FormData) => Promise<AssignmentEditState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Course</span>
          <SearchableSelect
            name="courseId"
            ariaLabel="Course"
            required
            defaultValue={courseId}
            options={courses.map((course) => ({ value: course.id, label: course.title }))}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Due date</span>
          <Input name="dueDate" type="date" defaultValue={dueDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Staff</span>
          <SearchableSelect
            name="staffId"
            ariaLabel="Staff"
            required
            defaultValue={staffId}
            options={staff.map((person) => ({ value: person.id, label: person.name }))}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Status</span>
          <SearchableSelect
            name="status"
            ariaLabel="Status"
            required
            defaultValue={status}
            options={STATUSES.map((value) => ({ value, label: assignmentStatusLabel(value) }))}
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
