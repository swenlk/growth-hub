import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { formatDay } from "@/lib/assignment-view";
import type { AssignmentStatus } from "@/lib/domain";
import { readChoice, readObjectId, readPage, withListQuery } from "@/lib/list-search";
import { getTenantContext, requireRole } from "@/lib/rbac";

import { updateAssignmentAction } from "../../actions";
import { AssignmentEditForm } from "../../edit-form";

export const metadata: Metadata = {
  title: "Edit assignment",
};

export const dynamic = "force-dynamic";

const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed"] as const satisfies readonly AssignmentStatus[];

export default async function EditAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ staff?: string; course?: string; status?: string; page?: string }>;
}) {
  const { assignmentId } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(assignmentId).success) notFound();

  await requireRole("tenant_admin");
  const { models } = await getTenantContext();
  const [person, staff, courses] = await Promise.all([
    models.Staff.findOne({ "assignments.assignmentId": assignmentId }).select("name assignments").lean(),
    models.Staff.find().sort({ name: 1 }).select("name").lean(),
    models.Course.find().sort({ title: 1 }).select("title").lean(),
  ]);
  const assignment = person?.assignments.find((item) => item.assignmentId === assignmentId);
  if (!person || !assignment) notFound();

  const courseOptions = courses.map((course) => ({ id: course._id.toString(), title: course.title }));
  if (!courseOptions.some((course) => course.id === String(assignment.courseId))) {
    courseOptions.unshift({ id: String(assignment.courseId), title: "Course removed" });
  }

  return (
    <>
      <DashboardBreadcrumb
        title="Edit assignment"
        text="Assign"
        hint="Course, due date, people, and status are saved together."
        backHref={withListQuery("/admin/assignments", {
          staff: readObjectId(query.staff),
          course: readObjectId(query.course),
          status: readChoice(query.status, ASSIGNMENT_STATUSES),
          page: readPage(query.page),
        })}
      />
      <div className="card !h-auto">
        <AssignmentEditForm
          assignmentId={assignmentId}
          staffId={String(person._id)}
          courseId={String(assignment.courseId)}
          dueDate={assignment.dueDate ? formatDay(assignment.dueDate) : ""}
          status={assignment.status}
          staff={staff.map((member) => ({ id: member._id.toString(), name: member.name }))}
          courses={courseOptions}
          action={updateAssignmentAction}
        />
      </div>
    </>
  );
}
