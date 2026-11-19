import type { Metadata } from "next";
import Link from "next/link";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Courses",
};

export default function CoursesPage() {
  return (
    <Placeholder title="Courses" empty="No courses yet.">
      <p>
        A course is a title plus one video. Uploads will stream to disk, and the browser will send
        the duration it reads from the file.
      </p>
      <p>
        <Link href="/admin/courses/example" className="font-medium text-primary">
          Open a course page
        </Link>
      </p>
    </Placeholder>
  );
}
