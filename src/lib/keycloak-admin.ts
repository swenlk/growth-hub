import "server-only";

import { z } from "zod";

import { roleSchema } from "@/lib/validators";

const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).toLowerCase(),
    tenantId: z.string().trim().min(1).max(64).nullable(),
    role: roleSchema,
    temporaryPassword: z.string().min(8).max(128).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.role !== "super_admin" && !value.tenantId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tenantId"],
        message: "tenantId is required for this role",
      });
    }
  });

export type CreateKeycloakUserInput = z.infer<typeof createUserSchema>;

export class KeycloakAdminError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Settings = {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

function settings(): Settings {
  const issuer = process.env.KEYCLOAK_ISSUER?.trim();
  const baseUrl = (process.env.KEYCLOAK_INTERNAL_URL ?? "").trim().replace(/\/$/, "");
  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID?.trim();
  const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET?.trim();

  if (!issuer || !baseUrl || !clientId || !clientSecret) {
    throw new KeycloakAdminError("Keycloak admin client is not configured", 500);
  }

  const match = new URL(issuer).pathname.match(/\/realms\/([^/]+)/);
  const realm = match?.[1] ? decodeURIComponent(match[1]) : "";
  if (!realm) {
    throw new KeycloakAdminError("KEYCLOAK_ISSUER must include the realm", 500);
  }

  return { baseUrl, realm, clientId, clientSecret };
}

async function adminToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 15_000) {
    return tokenCache.accessToken;
  }

  const config = settings();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetch(
    `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    tokenCache = null;
    throw new KeycloakAdminError("Keycloak admin token request failed", response.status);
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token || !json.expires_in) {
    throw new KeycloakAdminError("Keycloak admin token response was incomplete", 502);
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = settings();
  const token = await adminToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${config.baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { errorMessage?: string; error?: string };
    return body.errorMessage || body.error || fallback;
  } catch {
    return fallback;
  }
}

function userIdFromLocation(location: string | null): string {
  if (!location) {
    throw new KeycloakAdminError("Keycloak did not return the new user id", 502);
  }
  const id = location.split("/").filter(Boolean).pop();
  if (!id) {
    throw new KeycloakAdminError("Keycloak did not return the new user id", 502);
  }
  return decodeURIComponent(id);
}

export async function createUser(input: CreateKeycloakUserInput): Promise<string> {
  const user = createUserSchema.parse(input);
  const config = settings();
  const response = await adminFetch(`/admin/realms/${config.realm}/users`, {
    method: "POST",
    body: JSON.stringify({
      username: user.email,
      email: user.email,
      firstName: user.name,
      enabled: true,
      emailVerified: true,
      requiredActions: ["UPDATE_PASSWORD"],
      attributes: user.tenantId ? { tenantId: [user.tenantId] } : undefined,
    }),
  });

  if (response.status === 409) {
    throw new KeycloakAdminError("A Keycloak user with that email already exists", 409);
  }
  if (!response.ok) {
    throw new KeycloakAdminError(await errorMessage(response, "Could not create the Keycloak user"), response.status);
  }

  const userId = userIdFromLocation(response.headers.get("Location"));

  try {
    await assignRealmRole(userId, user.role);
    if (user.temporaryPassword) {
      await setTemporaryPassword(userId, user.temporaryPassword);
    }
  } catch (error) {
    await deleteUser(userId).catch(() => undefined);
    throw error;
  }

  return userId;
}

async function assignRealmRole(userId: string, roleName: string) {
  const config = settings();
  const roleResponse = await adminFetch(`/admin/realms/${config.realm}/roles/${roleName}`);
  if (!roleResponse.ok) {
    throw new KeycloakAdminError(`Could not read the ${roleName} role`, roleResponse.status);
  }
  const role = (await roleResponse.json()) as { id: string; name: string };
  const assigned = await adminFetch(`/admin/realms/${config.realm}/users/${userId}/role-mappings/realm`, {
    method: "POST",
    body: JSON.stringify([{ id: role.id, name: role.name }]),
  });
  if (!assigned.ok) {
    throw new KeycloakAdminError(await errorMessage(assigned, "Could not assign the realm role"), assigned.status);
  }
}

export async function setTemporaryPassword(userId: string, password: string) {
  const parsed = z.string().min(8).max(128).parse(password);
  const config = settings();
  const response = await adminFetch(`/admin/realms/${config.realm}/users/${userId}/reset-password`, {
    method: "PUT",
    body: JSON.stringify({ type: "password", value: parsed, temporary: true }),
  });
  if (!response.ok) {
    throw new KeycloakAdminError(await errorMessage(response, "Could not set a temporary password"), response.status);
  }
}

export async function enableUser(userId: string) {
  await setUserEnabled(userId, true);
}

export async function disableUser(userId: string) {
  await setUserEnabled(userId, false);
}

async function setUserEnabled(userId: string, enabled: boolean) {
  const config = settings();
  const current = await adminFetch(`/admin/realms/${config.realm}/users/${userId}`);
  if (current.status === 404) {
    throw new KeycloakAdminError("Keycloak user was not found", 404);
  }
  if (!current.ok) {
    throw new KeycloakAdminError("Could not read the Keycloak user", current.status);
  }
  const user = (await current.json()) as Record<string, unknown>;
  const response = await adminFetch(`/admin/realms/${config.realm}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ ...user, enabled }),
  });
  if (!response.ok) {
    const fallback = enabled ? "Could not enable the Keycloak user" : "Could not disable the Keycloak user";
    throw new KeycloakAdminError(await errorMessage(response, fallback), response.status);
  }
}

export async function deleteUser(userId: string) {
  const config = settings();
  const response = await adminFetch(`/admin/realms/${config.realm}/users/${userId}`, { method: "DELETE" });
  if (response.status === 404) return;
  if (!response.ok) {
    throw new KeycloakAdminError(await errorMessage(response, "Could not delete the Keycloak user"), response.status);
  }
}
