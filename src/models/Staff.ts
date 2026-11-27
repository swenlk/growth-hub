import { Schema, type Types } from "mongoose";

import {
  ASSIGNMENT_STATUSES,
  STAFF_STATUSES,
  type AssignmentProgress,
  type AssignmentStatus,
  type StaffStatus,
} from "@/lib/domain";

export interface Assignment {
  /** Stable id for this assignment instance. Progress APIs use this, not courseId. */
  assignmentId: string;
  courseId: Types.ObjectId;
  assignedDate: Date;
  /** Keycloak user id of the admin who assigned the course. */
  assignedBy: string;
  dueDate?: Date;
  status: AssignmentStatus;
  progress: AssignmentProgress;
  completedDate?: Date;
}

export interface Staff {
  _id: Types.ObjectId;
  name: string;
  email: string;
  keycloakUserId: string;
  status: StaffStatus;
  /**
   * Repeated assignments of the same course are new objects.
   * Updates must match assignments.assignmentId and must not replace the array.
   */
  assignments: Assignment[];
  createdDate: Date;
  updatedDate: Date;
}

const progressSchema = new Schema<AssignmentProgress>(
  {
    watchedRanges: { type: [[Number]], default: [] },
    watchedSeconds: { type: Number, required: true, default: 0, min: 0 },
    lastPositionSeconds: { type: Number, required: true, default: 0, min: 0 },
    videoCompleted: { type: Boolean, required: true, default: false },
    videoCompletedDate: { type: Date },
    lastHeartbeatDate: { type: Date },
  },
  { _id: false },
);

const assignmentSchema = new Schema<Assignment>(
  {
    assignmentId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    assignedDate: { type: Date, required: true },
    assignedBy: { type: String, required: true },
    dueDate: { type: Date },
    status: { type: String, enum: ASSIGNMENT_STATUSES, required: true, default: "assigned" },
    progress: { type: progressSchema, required: true, default: () => ({}) },
    completedDate: { type: Date },
  },
  { _id: false },
);

export const staffSchema = new Schema<Staff>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    keycloakUserId: { type: String, required: true },
    status: { type: String, enum: STAFF_STATUSES, required: true, default: "active" },
    assignments: { type: [assignmentSchema], default: [] },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } },
);

staffSchema.index({ email: 1 }, { unique: true });
staffSchema.index({ keycloakUserId: 1 }, { unique: true });
