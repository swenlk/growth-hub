/**
 * Idempotent Keycloak bootstrap for the single `growth-hub` realm.
 * Run on the host after Keycloak is healthy:
 *   npm run setup:keycloak
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

const REALM = "growth-hub";
const WEB_CLIENT_ID = "growth-hub-web";
const ADMIN_CLIENT_ID = "growth-hub-admin";
const REALM_ROLES = ["super_admin", "tenant_admin", "staff"] as const;
const SERVICE_ACCOUNT_ROLES = ["manage-users", "view-users", "query-users", "view-realm"] as const;

const envSchema = z.object({
  baseUrl: z.string().url(),
  adminUsername: z.string().min(1),
  adminPassword: z.string().min(1),
});

type KcClient = {
  id?: string;
  clientId?: string;
  name?: string;
  enabled?: boolean;
  protocol?: string;
  publicClient?: boolean;
  clientAuthenticatorType?: string;
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  attributes?: Record<string, string>;
};

type ProtocolMapper = {
  id?: string;
  name: string;
  protocol: string;
  protocolMapper: string;
  config: Record<string, string>;
};

type RoleRep = {
  id: string;
  name: string;
};

function loadEnvFiles() {
  const merged = new Map<string, string>();

  for (const filename of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      merged.set(key, value);
    }
  }

  for (const [key, value] of merged) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function adminBaseUrl(): string {
  if (process.env.KEYCLOAK_URL) {
    return process.env.KEYCLOAK_URL.replace(/\/$/, "");
  }

  if (process.env.KEYCLOAK_ISSUER) {
    return new URL(process.env.KEYCLOAK_ISSUER).origin;
  }

  return "http://localhost:8080";
}

async function waitForKeycloak(baseUrl: string) {
  let lastError = "no response";

  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/realms/master`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "connection failed";
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }

  throw new Error(`Keycloak is not reachable at ${baseUrl} (${lastError})`);
}

async function adminToken(baseUrl: string, username: string, password: string) {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username,
    password,
  });

  const response = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error("Keycloak rejected the admin username or password");
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Keycloak admin token response had no access_token");
  }

  return json.access_token;
}

function api(baseUrl: string, token: string) {
  return async function request(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
}

async function readError(response: Response) {
  const text = (await response.text()).trim();
  return text.slice(0, 400) || response.statusText;
}

async function ensureRealm(request: ReturnType<typeof api>) {
  const existing = await request("GET", `/admin/realms/${REALM}`);

  if (existing.status === 404) {
    const created = await request("POST", "/admin/realms", {
      realm: REALM,
      enabled: true,
    });
    if (!created.ok) {
      throw new Error(`Could not create realm ${REALM}: ${await readError(created)}`);
    }
  } else if (!existing.ok) {
    throw new Error(`Could not read realm ${REALM}: ${await readError(existing)}`);
  }

  const currentResponse = await request("GET", `/admin/realms/${REALM}`);
  if (!currentResponse.ok) {
    throw new Error(`Could not read realm ${REALM}: ${await readError(currentResponse)}`);
  }

  const realm = (await currentResponse.json()) as Record<string, unknown>;
  realm.loginWithEmailAllowed = true;
  realm.editUsernameAllowed = false;
  realm.bruteForceProtected = true;
  // Dev only. The web container is not localhost from Keycloak's point of view.
  realm.sslRequired = "NONE";
  realm.loginTheme = "growth-hub";

  const updated = await request("PUT", `/admin/realms/${REALM}`, realm);
  if (!updated.ok) {
    throw new Error(`Could not update realm ${REALM}: ${await readError(updated)}`);
  }
}

async function ensureRealmRoles(request: ReturnType<typeof api>) {
  for (const role of REALM_ROLES) {
    const existing = await request("GET", `/admin/realms/${REALM}/roles/${role}`);
    if (existing.ok) continue;
    if (existing.status !== 404) {
      throw new Error(`Could not read role ${role}: ${await readError(existing)}`);
    }

    const created = await request("POST", `/admin/realms/${REALM}/roles`, {
      name: role,
      description: `Training platform role ${role}`,
    });
    if (!created.ok) {
      throw new Error(`Could not create role ${role}: ${await readError(created)}`);
    }
  }
}

async function findClient(request: ReturnType<typeof api>, clientId: string) {
  const response = await request("GET", `/admin/realms/${REALM}/clients?clientId=${encodeURIComponent(clientId)}`);
  if (!response.ok) {
    throw new Error(`Could not list client ${clientId}: ${await readError(response)}`);
  }

  const clients = (await response.json()) as KcClient[];
  return clients.find((client) => client.clientId === clientId);
}

async function ensureClient(request: ReturnType<typeof api>, desired: KcClient) {
  const existing = await findClient(request, desired.clientId ?? "");

  if (!existing) {
    const created = await request("POST", `/admin/realms/${REALM}/clients`, desired);
    if (!created.ok) {
      throw new Error(`Could not create client ${desired.clientId}: ${await readError(created)}`);
    }
  } else if (existing.id) {
    const updated = await request("PUT", `/admin/realms/${REALM}/clients/${existing.id}`, {
      ...existing,
      ...desired,
      id: existing.id,
      attributes: { ...existing.attributes, ...desired.attributes },
    });
    if (!updated.ok) {
      throw new Error(`Could not update client ${desired.clientId}: ${await readError(updated)}`);
    }
  }

  const client = await findClient(request, desired.clientId ?? "");
  if (!client?.id) {
    throw new Error(`Client ${desired.clientId} has no id after save`);
  }
  return client.id;
}

async function ensureMapper(request: ReturnType<typeof api>, clientUuid: string, mapper: ProtocolMapper) {
  const response = await request("GET", `/admin/realms/${REALM}/clients/${clientUuid}/protocol-mappers/models`);
  if (!response.ok) {
    throw new Error(`Could not list mappers: ${await readError(response)}`);
  }

  const mappers = (await response.json()) as ProtocolMapper[];
  const existing = mappers.find((item) => item.name === mapper.name);

  if (!existing) {
    const created = await request(
      "POST",
      `/admin/realms/${REALM}/clients/${clientUuid}/protocol-mappers/models`,
      mapper,
    );
    if (!created.ok) {
      throw new Error(`Could not create mapper ${mapper.name}: ${await readError(created)}`);
    }
    return;
  }

  const updated = await request(
    "PUT",
    `/admin/realms/${REALM}/clients/${clientUuid}/protocol-mappers/models/${existing.id}`,
    { ...existing, ...mapper, id: existing.id },
  );
  if (!updated.ok) {
    throw new Error(`Could not update mapper ${mapper.name}: ${await readError(updated)}`);
  }
}

async function ensureTenantAttribute(request: ReturnType<typeof api>) {
  const response = await request("GET", `/admin/realms/${REALM}/users/profile`);
  if (!response.ok) {
    throw new Error(`Could not read user profile: ${await readError(response)}`);
  }

  const profile = (await response.json()) as {
    attributes?: Array<Record<string, unknown>>;
    unmanagedAttributePolicy?: string;
  };

  const attributes = profile.attributes ?? [];
  if (!attributes.some((attribute) => attribute.name === "tenantId")) {
    attributes.push({
      name: "tenantId",
      displayName: "Tenant ID",
      permissions: { view: ["admin"], edit: ["admin"] },
      multivalued: false,
    });
  }

  // The app stores one display name. A required last name blocks first login.
  for (const attribute of attributes) {
    if (attribute.name === "lastName") {
      delete attribute.required;
    }
  }

  const updated = await request("PUT", `/admin/realms/${REALM}/users/profile`, {
    ...profile,
    attributes,
    unmanagedAttributePolicy: profile.unmanagedAttributePolicy ?? "ADMIN_EDIT",
  });
  if (!updated.ok) {
    throw new Error(`Could not update user profile: ${await readError(updated)}`);
  }
}

async function ensureAdminApiScope(request: ReturnType<typeof api>, clientUuid: string) {
  // Keycloak 26.8 rejects Admin API calls unless the token includes this scope.
  const scopesResponse = await request("GET", `/admin/realms/${REALM}/client-scopes`);
  if (!scopesResponse.ok) {
    throw new Error(`Could not list client scopes: ${await readError(scopesResponse)}`);
  }
  const scopes = (await scopesResponse.json()) as Array<{ id: string; name: string }>;
  const adminScope = scopes.find((scope) => scope.name === "kc-admin-api");
  if (!adminScope) {
    throw new Error("Keycloak client scope kc-admin-api is missing");
  }

  const assignedResponse = await request(
    "GET",
    `/admin/realms/${REALM}/clients/${clientUuid}/default-client-scopes`,
  );
  if (!assignedResponse.ok) {
    throw new Error(`Could not list default client scopes: ${await readError(assignedResponse)}`);
  }
  const assigned = (await assignedResponse.json()) as Array<{ id: string }>;
  if (assigned.some((scope) => scope.id === adminScope.id)) return;

  const added = await request(
    "PUT",
    `/admin/realms/${REALM}/clients/${clientUuid}/default-client-scopes/${adminScope.id}`,
  );
  if (!added.ok) {
    throw new Error(`Could not assign kc-admin-api scope: ${await readError(added)}`);
  }
}

async function ensureServiceAccountRoles(request: ReturnType<typeof api>, clientUuid: string) {
  const userResponse = await request("GET", `/admin/realms/${REALM}/clients/${clientUuid}/service-account-user`);
  if (!userResponse.ok) {
    throw new Error(`Could not read service account: ${await readError(userResponse)}`);
  }
  const user = (await userResponse.json()) as { id: string };

  const realmManagement = await findClient(request, "realm-management");
  if (!realmManagement?.id) {
    throw new Error("realm-management client is missing");
  }

  const roles: RoleRep[] = [];
  for (const roleName of SERVICE_ACCOUNT_ROLES) {
    const roleResponse = await request(
      "GET",
      `/admin/realms/${REALM}/clients/${realmManagement.id}/roles/${roleName}`,
    );
    if (!roleResponse.ok) {
      throw new Error(`Could not read realm-management role ${roleName}: ${await readError(roleResponse)}`);
    }
    roles.push((await roleResponse.json()) as RoleRep);
  }

  const assigned = await request(
    "POST",
    `/admin/realms/${REALM}/users/${user.id}/role-mappings/clients/${realmManagement.id}`,
    roles,
  );
  if (!assigned.ok) {
    throw new Error(`Could not grant service account roles: ${await readError(assigned)}`);
  }
}

async function clientSecret(request: ReturnType<typeof api>, clientUuid: string) {
  const response = await request("GET", `/admin/realms/${REALM}/clients/${clientUuid}/client-secret`);
  if (!response.ok) {
    throw new Error(`Could not read client secret: ${await readError(response)}`);
  }
  const secret = (await response.json()) as { value?: string };
  if (!secret.value) {
    throw new Error("Client secret was empty");
  }
  return secret.value;
}

async function main() {
  loadEnvFiles();

  const env = envSchema.parse({
    baseUrl: adminBaseUrl(),
    adminUsername: process.env.KEYCLOAK_ADMIN ?? process.env.KEYCLOAK_ADMIN_USERNAME,
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD,
  });

  await waitForKeycloak(env.baseUrl);
  const token = await adminToken(env.baseUrl, env.adminUsername, env.adminPassword);
  const request = api(env.baseUrl, token);

  await ensureRealm(request);
  await ensureRealmRoles(request);
  await ensureTenantAttribute(request);

  const webClientId = await ensureClient(request, {
    clientId: WEB_CLIENT_ID,
    name: "Growth Hub web",
    enabled: true,
    protocol: "openid-connect",
    publicClient: false,
    clientAuthenticatorType: "client-secret",
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: ["http://localhost:3000/*"],
    webOrigins: ["http://localhost:3000"],
    attributes: {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "http://localhost:3000/*",
    },
  });

  const adminClientId = await ensureClient(request, {
    clientId: ADMIN_CLIENT_ID,
    name: "Growth Hub admin",
    enabled: true,
    protocol: "openid-connect",
    publicClient: false,
    clientAuthenticatorType: "client-secret",
    standardFlowEnabled: false,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: true,
  });

  await ensureMapper(request, webClientId, {
    name: "tenantId",
    protocol: "openid-connect",
    protocolMapper: "oidc-usermodel-attribute-mapper",
    config: {
      "user.attribute": "tenantId",
      "claim.name": "tenantId",
      "jsonType.label": "String",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true",
    },
  });

  await ensureMapper(request, webClientId, {
    name: "roles",
    protocol: "openid-connect",
    protocolMapper: "oidc-usermodel-realm-role-mapper",
    config: {
      "claim.name": "roles",
      "jsonType.label": "String",
      multivalued: "true",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true",
    },
  });

  await ensureServiceAccountRoles(request, adminClientId);
  await ensureAdminApiScope(request, adminClientId);

  const webSecret = await clientSecret(request, webClientId);
  const adminSecret = await clientSecret(request, adminClientId);

  console.log("");
  console.log("Realm `growth-hub` is ready. Put these values in .env.local:");
  console.log("");
  console.log(`KEYCLOAK_ISSUER=${env.baseUrl}/realms/${REALM}`);
  console.log(`KEYCLOAK_CLIENT_ID=${WEB_CLIENT_ID}`);
  console.log(`KEYCLOAK_CLIENT_SECRET=${webSecret}`);
  console.log(`KEYCLOAK_ADMIN_CLIENT_ID=${ADMIN_CLIENT_ID}`);
  console.log(`KEYCLOAK_ADMIN_CLIENT_SECRET=${adminSecret}`);
  console.log("");
  console.log("On the host, KEYCLOAK_INTERNAL_URL=http://localhost:8080");
  console.log("Inside Compose, the web service sets KEYCLOAK_INTERNAL_URL=http://keycloak:8080");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Keycloak setup failed";
  console.error(message);
  process.exit(1);
});
