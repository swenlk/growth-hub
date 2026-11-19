"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignmentStatusLabel } from "@/lib/assignment-view";
import type { AssignmentStatus } from "@/lib/domain";

import type { AssignmentEditState } from "./actions";

const selectClass =
  "border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
    <form action={formAction} className="max-w-3xl space-y-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Staff
          <select name="staffId" defaultValue={staffId} required className={selectClass}>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Course
          <select name="courseId" defaultValue={courseId} required className={selectClass}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Due date
          <Input name="dueDate" type="date" defaultValue={dueDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Status
          <select name="status" defaultValue={status} required className={selectClass}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {assignmentStatusLabel(value)}
              </option>
            ))}
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
