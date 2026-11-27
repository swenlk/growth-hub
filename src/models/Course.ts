import { Schema, type Types } from "mongoose";

import { COURSE_STATUSES, type CourseStatus } from "@/lib/domain";

export interface CourseVideo {
  /** uuid plus extension. Never the original upload name. */
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Captured in the browser from loadedmetadata at upload time. */
  durationSeconds: number;
}

export interface CourseDocument {
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Course {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  /** First video. Kept so older documents and readers still resolve one file. */
  video: CourseVideo;
  videos?: CourseVideo[];
  /** Optional PDFs. Opening one does not affect watch progress. */
  documents?: CourseDocument[];
  status: CourseStatus;
  createdDate: Date;
  updatedDate: Date;
}

const courseDocumentSchema = new Schema<CourseDocument>(
  {
    storedFileName: { type: String, required: true },
    originalFileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const courseVideoSchema = new Schema<CourseVideo>(
  {
    storedFileName: { type: String, required: true },
    originalFileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const courseSchema = new Schema<Course>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    video: { type: courseVideoSchema, required: true },
    videos: { type: [courseVideoSchema], required: false },
    documents: { type: [courseDocumentSchema], required: false },
    status: { type: String, enum: COURSE_STATUSES, required: true, default: "active" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } },
);
