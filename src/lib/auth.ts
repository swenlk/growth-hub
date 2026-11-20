import NextAuth, { customFetch } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

import { readRoles, readTenantId } from "@/lib/access";
import type { AppRole } from "@/lib/domain";
import "@/types/auth";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
};

function requiredEnv(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function issuerOrigin(issuer: string): string {
  try {
    return new URL(issuer).origin;
  } catch {
    return "http://localhost:8080";
  }
}

function realmFromIssuer(issuer: string): string {
  try {
    const match = new URL(issuer).pathname.match(/\/realms\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "growth-hub";
  } catch {
    return "growth-hub";
  }
}

/**
 * The browser and the token `iss` claim use KEYCLOAK_ISSUER (localhost).
 * The Next.js container must call KEYCLOAK_INTERNAL_URL (http://keycloak:8080).
 * Discovery still advertises the public issuer; only the server-side fetch is rewritten.
 */
function keycloakServerFetch(publicOrigin: string, internalBase: string): typeof fetch {
  let internal: URL;
  try {
    internal = new URL(internalBase);
  } catch {
    internal = new URL(publicOrigin);
  }

  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === publicOrigin) {
      url.protocol = internal.protocol;
      url.hostname = internal.hostname;
      url.port = internal.port;
    }
    return fetch(new Request(url, request));
  };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const segment = jwt.split(".")[1];
  if (!segment) return {};
  try {
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as unknown;
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function refreshKeycloakToken(refreshToken: string): Promise<TokenResponse> {
  const issuer = requiredEnv("KEYCLOAK_ISSUER", "http://localhost:8080/realms/growth-hub");
  const internalBase = requiredEnv("KEYCLOAK_INTERNAL_URL", issuerOrigin(issuer)).replace(/\/$/, "");
  const realm = realmFromIssuer(issuer);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: requiredEnv("KEYCLOAK_CLIENT_ID"),
    client_secret: requiredEnv("KEYCLOAK_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });

  const response = await fetch(
    `${internalBase}/realms/${realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw new Error("Keycloak refresh failed");
  }

  return (await response.json()) as TokenResponse;
}

const issuer = requiredEnv("KEYCLOAK_ISSUER", "http://localhost:8080/realms/growth-hub");
const internalBase = requiredEnv("KEYCLOAK_INTERNAL_URL", issuerOrigin(issuer)).replace(/\/$/, "");
const publicOrigin = issuerOrigin(issuer);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Keycloak({
      clientId: requiredEnv("KEYCLOAK_CLIENT_ID"),
      clientSecret: requiredEnv("KEYCLOAK_CLIENT_SECRET"),
      issuer,
      [customFetch]: keycloakServerFetch(publicOrigin, internalBase),
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const claims = profile as Record<string, unknown>;
        token.sub = typeof claims.sub === "string" ? claims.sub : token.sub;
        token.tenantId = readTenantId(claims.tenantId);
        token.roles = readRoles(claims.roles);
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        delete token.error;
        return token;
      }

      const expiresAt = typeof token.expiresAt === "number" ? token.expiresAt : 0;
      if (Date.now() < expiresAt * 1000 - 15_000) {
        return token;
      }

      if (typeof token.refreshToken !== "string" || token.refreshToken.length === 0) {
        token.error = "RefreshAccessTokenError";
        token.roles = [];
        return token;
      }

      try {
        const refreshed = await refreshKeycloakToken(token.refreshToken);
        if (!refreshed.access_token || !refreshed.expires_in) {
          throw new Error("Incomplete refresh response");
        }
        token.accessToken = refreshed.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        if (refreshed.refresh_token) {
          token.refreshToken = refreshed.refresh_token;
        }
        if (refreshed.id_token) {
          token.idToken = refreshed.id_token;
          const claims = decodeJwtPayload(refreshed.id_token);
          token.tenantId = readTenantId(claims.tenantId);
          token.roles = readRoles(claims.roles);
          if (typeof claims.sub === "string") token.sub = claims.sub;
        }
        delete token.error;
      } catch {
        token.error = "RefreshAccessTokenError";
        token.roles = [];
      }

      return token;
    },
    async session({ session, token }) {
      const roles = Array.isArray(token.roles) ? (token.roles as AppRole[]) : [];
      session.sub = token.error ? "" : (token.sub ?? "");
      session.tenantId = token.error ? null : (token.tenantId ?? null);
      session.roles = token.error ? [] : roles;
      if (session.user) {
        session.user.id = session.sub;
      }
      return session;
    },
  },
});
