import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Course",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Placeholder title="Course" empty="No assignments for this course yet.">
      <p>
        Course id <span className="font-mono">{id}</span>. The completion list will
        show one row per assignment, including repeated assignments for the same person.
      </p>
    </Placeholder>
  );
}
