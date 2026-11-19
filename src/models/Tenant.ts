import { Schema, type Types } from "mongoose";

import { TENANT_STATUSES, type TenantStatus } from "@/lib/domain";

export interface Tenant {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: Date;
}

export const tenantSchema = new Schema<Tenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      lowercase: true,
      trim: true,
    },
    status: { type: String, enum: TENANT_STATUSES, required: true, default: "active" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
