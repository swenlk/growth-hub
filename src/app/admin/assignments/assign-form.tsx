"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssignFormState } from "./actions";

const emptyAssignFormState: AssignFormState = { error: null, created: null };

const selectClass =
  "border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AssignForm({
  courses,
  staff,
  action,
}: {
  courses: { id: string; title: string }[];
  staff: { id: string; name: string; email: string }[];
  action: (previous: AssignFormState, formData: FormData) => Promise<AssignFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyAssignFormState);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = staff.filter((person) => selected[person.id]).length;
  const allSelected = staff.length > 0 && selectedCount === staff.length;

  if (courses.length === 0 || staff.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-300">
        {courses.length === 0
          ? "Create an active course before assigning it."
          : "Add active staff before assigning a course."}
      </p>
    );
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium">
        Course
        <select name="courseId" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Due date
        <Input name="dueDate" type="date" />
      </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Staff</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelected(Object.fromEntries(staff.map((person) => [person.id, checked])));
            }}
          />
          Select all
        </label>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-neutral-200 p-3 dark:border-slate-600">
          {staff.map((person) => (
            <label key={person.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="staffIds"
                value={person.id}
                checked={Boolean(selected[person.id])}
                onChange={(event) => {
                  setSelected((current) => ({ ...current, [person.id]: event.target.checked }));
                }}
              />
              <span>
                {person.name}
                <span className="block text-neutral-500 dark:text-neutral-300">{person.email}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-neutral-500 dark:text-neutral-300">
        Each selected person gets a new assignment. Someone who already has this course keeps the
        earlier one as well. A due date runs through 23:59 UTC.
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.created ? (
        <p className="text-sm text-green-600">
          Created {state.created} {state.created === 1 ? "assignment" : "assignments"}.
        </p>
      ) : null}
      <Button type="submit" disabled={pending || selectedCount === 0}>
        {pending ? "Assigning…" : "Assign course"}
      </Button>
    </form>
  );
}
