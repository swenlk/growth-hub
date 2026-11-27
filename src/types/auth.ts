import type { AppRole } from "@/lib/domain";

declare module "next-auth" {
  interface Session {
    sub: string;
    tenantId: string | null;
    roles: AppRole[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    tenantId?: string | null;
    roles?: AppRole[];
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}

export {};
