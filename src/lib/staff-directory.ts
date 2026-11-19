import "server-only";

import { randomUUID } from "node:crypto";

import { StaffModel } from "@/models/Staff";
import {
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  KeycloakAdminError,
} from "@/lib/keycloak-admin";
import { temporaryPassword } from "@/lib/passwords";
import { tenantObjectId } from "@/lib/rbac";
import { createStaffSchema, type CreateStaffInput } from "@/lib/validators";
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

/**
 * Mongo row first, then the Keycloak user. The Keycloak tenantId is the session
 * tenant, never a value from the form. A Keycloak failure deletes the Mongo row.
 */
export async function createStaffMember(
  tenantId: string,
  input: CreateStaffInput,
): Promise<{ email: string; temporaryPassword: string }> {
  const parsed = createStaffSchema.parse(input);
  const tenantObject = tenantObjectId(tenantId);
  let staff;

  try {
    staff = await StaffModel.create({
      tenantId: tenantObject,
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
      tenantId,
      role: "staff",
      temporaryPassword: password,
    });
    staff.keycloakUserId = keycloakUserId;
    await staff.save();
  } catch (error) {
    await StaffModel.deleteOne({ _id: staff._id, tenantId: tenantObject });
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

export async function setStaffStatus(tenantId: string, staffId: string, status: StaffStatus) {
  const tenantObject = tenantObjectId(tenantId);
  const staff = await StaffModel.findOne({ _id: staffId, tenantId: tenantObject });
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
