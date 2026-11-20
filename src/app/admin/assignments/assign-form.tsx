"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { AssignFormState } from "./actions";

const emptyAssignFormState: AssignFormState = { error: null, created: null };

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
  const [selectedCount, setSelectedCount] = useState(0);

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
    <form action={formAction} className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Course</span>
          <SearchableSelect
            name="courseId"
            ariaLabel="Course"
            required
            placeholder="Choose a course"
            options={courses.map((course) => ({ value: course.id, label: course.title }))}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex h-6 items-center">Due date</span>
          <Input name="dueDate" type="date" />
        </label>
        <SearchableMultiSelect
          name="staffIds"
          label="Staff"
          ariaLabel="Staff"
          placeholder="Select staff"
          options={staff.map((person) => ({ value: person.id, label: person.name, description: person.email }))}
          onChange={(ids) => setSelectedCount(ids.length)}
        />
      </div>
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
