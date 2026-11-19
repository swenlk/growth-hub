import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Assignments",
};

export default function AssignmentsPage() {
  return (
    <Placeholder title="Assignments" empty="No assignments yet.">
      <p>
        Assign one course to one or many staff members. Each person receives a new assignment
        object, even when they already have that course.
      </p>
    </Placeholder>
  );
}
