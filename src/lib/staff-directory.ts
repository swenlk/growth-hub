import "server-only";

import { randomUUID } from "node:crypto";

import type { Model } from "mongoose";

import {
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  KeycloakAdminError,
  setTemporaryPassword,
  updateStaffAccount,
} from "@/lib/keycloak-admin";
import type { TenantContext } from "@/lib/rbac";
import { temporaryPassword } from "@/lib/passwords";
import type { Staff } from "@/models/Staff";
import { createStaffSchema, updateStaffSchema, type CreateStaffInput, type UpdateStaffInput } from "@/lib/validators";
import type { StaffStatus } from "@/lib/domain";

export class StaffDirectoryError extends Error {}

function duplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

type StaffWriter = Pick<TenantContext, "slug" | "models">;

/**
 * Mongo row first, then the Keycloak user. The Staff model and slug both come from
 * getTenantContext(). Keycloak receives that slug, never a value from the form.
 * A Keycloak failure deletes the Mongo row.
 */
export async function createStaffMember(
  ctx: StaffWriter,
  input: CreateStaffInput,
): Promise<{ email: string; temporaryPassword: string }> {
  const parsed = createStaffSchema.parse(input);
  const Staff: Model<Staff> = ctx.models.Staff;
  let staff;

  try {
    staff = await Staff.create({
      name: parsed.name,
      email: parsed.email,
      keycloakUserId: `pending:${randomUUID()}`,
      status: "active",
      assignments: [],
    });
  } catch (error) {
    if (duplicateKey(error)) {
      throw new StaffDirectoryError("That email is already used in this organization");
    }
    throw error;
  }

  const password = temporaryPassword();
  let keycloakUserId: string | null = null;

  try {
    keycloakUserId = await createUser({
      name: parsed.name,
      email: parsed.email,
      tenantId: ctx.slug,
      role: "staff",
      temporaryPassword: password,
    });
    staff.keycloakUserId = keycloakUserId;
    await staff.save();
  } catch (error) {
    await Staff.deleteOne({ _id: staff._id });
    if (keycloakUserId) {
      await deleteUser(keycloakUserId).catch(() => undefined);
    }
    if (error instanceof KeycloakAdminError && error.status === 409) {
      throw new StaffDirectoryError("That email is already used");
    }
    if (error instanceof KeycloakAdminError) {
      throw new StaffDirectoryError(error.message);
    }
    throw error;
  }

  return { email: parsed.email, temporaryPassword: password };
}

/** Name, status, and an optional new sign-in password are saved together. Email stays the sign-in identity. */
export async function updateStaffMember(ctx: Pick<TenantContext, "models">, staffId: string, input: UpdateStaffInput) {
  const parsed = updateStaffSchema.parse(input);
  const staff = await ctx.models.Staff.findById(staffId);
  if (!staff) {
    throw new StaffDirectoryError("Staff member was not found");
  }
  if (staff.keycloakUserId.startsWith("pending:")) {
    throw new StaffDirectoryError("This person is not linked to a sign-in account");
  }

  const password = parsed.password;
  const profileChanged = staff.name !== parsed.name || staff.status !== parsed.status;
  if (!profileChanged && password.length === 0) return;

  if (profileChanged) {
    const previous = { name: staff.name, enabled: staff.status === "active" };
    try {
      await updateStaffAccount(staff.keycloakUserId, {
        name: parsed.name,
        enabled: parsed.status === "active",
      });
    } catch (error) {
      if (error instanceof KeycloakAdminError) throw new StaffDirectoryError(error.message);
      throw error;
    }

    try {
      staff.name = parsed.name;
      staff.status = parsed.status;
      await staff.save();
    } catch (error) {
      await updateStaffAccount(staff.keycloakUserId, previous).catch(() => undefined);
      throw error;
    }
  }

  if (password.length > 0) {
    try {
      await setTemporaryPassword(staff.keycloakUserId, password);
    } catch (error) {
      if (error instanceof KeycloakAdminError) throw new StaffDirectoryError(error.message);
      throw error;
    }
  }
}

export async function setStaffStatus(ctx: Pick<TenantContext, "models">, staffId: string, status: StaffStatus) {
  const staff = await ctx.models.Staff.findOne({ _id: staffId });
  if (!staff) {
    throw new StaffDirectoryError("Staff member was not found");
  }
  if (staff.status === status) return;
  if (staff.keycloakUserId.startsWith("pending:")) {
    throw new StaffDirectoryError("This person is not linked to a sign-in account");
  }

  if (status === "disabled") {
    await disableUser(staff.keycloakUserId);
  } else {
    await enableUser(staff.keycloakUserId);
  }

  try {
    staff.status = status;
    await staff.save();
  } catch (error) {
    if (status === "disabled") {
      await enableUser(staff.keycloakUserId).catch(() => undefined);
    } else {
      await disableUser(staff.keycloakUserId).catch(() => undefined);
    }
    throw error;
  }
}
