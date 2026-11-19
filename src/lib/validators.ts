import { z } from "zod";

import {
  ASSIGNMENT_STATUSES,
  COURSE_STATUSES,
  ROLES,
  STAFF_STATUSES,
  TENANT_STATUSES,
} from "@/lib/domain";

export const roleSchema = z.enum(ROLES);
export const tenantStatusSchema = z.enum(TENANT_STATUSES);
export const courseStatusSchema = z.enum(COURSE_STATUSES);
export const staffStatusSchema = z.enum(STAFF_STATUSES);
export const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema,
    adminName: z.string().trim().min(1).max(120),
    adminEmail: z.string().trim().email().max(254).toLowerCase(),
  })
  .strict();

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).toLowerCase(),
  })
  .strict();

export const courseDetailsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional(),
    durationSeconds: z
      .number()
      .finite()
      .positive()
      .max(24 * 60 * 60, "Video length must be under 24 hours"),
  })
  .strict();

export const createAssignmentSchema = z
  .object({
    courseId: objectIdSchema,
    staffIds: z.array(objectIdSchema).min(1),
    dueDate: z.string().datetime().optional(),
  })
  .strict();

/** One continuous playback span since the previous heartbeat. */
export const progressHeartbeatSchema = z
  .object({
    from: z.number().finite().nonnegative(),
    to: z.number().finite().positive(),
    position: z.number().finite().nonnegative(),
  })
  .strict()
  .refine((value) => value.from < value.to, {
    message: "from must be less than to",
  });

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type CourseDetailsInput = z.infer<typeof courseDetailsSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ProgressHeartbeatInput = z.infer<typeof progressHeartbeatSchema>;
