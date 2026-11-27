import { z } from "zod";

import {
  ASSIGNMENT_STATUSES,
  COURSE_STATUSES,
  ROLES,
  STAFF_STATUSES,
  TENANT_STATUSES,
} from "@/lib/domain";
import { RESERVED_SLUGS, SLUG_MAX, SLUG_REGEX } from "@/lib/tenant";

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
  .max(SLUG_MAX)
  .toLowerCase()
  .regex(SLUG_REGEX, "Use lowercase letters, numbers, and hyphens")
  .refine((slug) => !RESERVED_SLUGS.has(slug), "That tenant is reserved");

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    tenant: slugSchema,
    adminName: z.string().trim().min(1).max(120),
    adminEmail: z.string().trim().email().max(254).toLowerCase(),
  })
  .strict();

export const updateTenantStatusSchema = z
  .object({
    status: tenantStatusSchema,
  })
  .strict();

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    status: tenantStatusSchema,
  })
  .strict();

export const createTenantAdminSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).toLowerCase(),
  })
  .strict();

export const updateTenantAdminSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    status: staffStatusSchema,
  })
  .strict();

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).toLowerCase(),
  })
  .strict();

export const changeOwnPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string().min(1, "Confirm the new password").max(128),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

export const updateStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    status: staffStatusSchema,
    password: z
      .string()
      .trim()
      .max(128)
      .refine((value) => value.length === 0 || value.length >= 8, "Password must be at least 8 characters"),
  })
  .strict();

export const videoDurationSchema = z
  .number()
  .finite()
  .positive()
  .max(24 * 60 * 60, "Video length must be under 24 hours");

export const courseTextSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional(),
  })
  .strict();

export const courseDetailsSchema = courseTextSchema
  .extend({
    durationSeconds: videoDurationSchema,
  })
  .strict();

export const updateCourseSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000),
    status: courseStatusSchema,
  })
  .strict();

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid due date");

export const updateAssignmentSchema = z
  .object({
    staffId: objectIdSchema,
    courseId: objectIdSchema,
    dueDate: calendarDateSchema.optional(),
    status: assignmentStatusSchema,
  })
  .strict();

export const createAssignmentSchema = z
  .object({
    courseId: objectIdSchema,
    staffIds: z.array(objectIdSchema).min(1).max(200),
    dueDate: calendarDateSchema.optional(),
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
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type CourseDetailsInput = z.infer<typeof courseDetailsSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ProgressHeartbeatInput = z.infer<typeof progressHeartbeatSchema>;
