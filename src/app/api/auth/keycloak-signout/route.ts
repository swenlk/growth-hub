import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appOrigin(): string {
  const configured = process.env.AUTH_URL?.trim() || "http://localhost:3002";
  return configured.replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const idToken = typeof token?.idToken === "string" ? token.idToken : "";
  const issuer = (process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/growth-hub").replace(
    /\/$/,
    "",
  );
  const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim() || "growth-hub-web";
  const form = await request.formData().catch(() => null);
  const returnTo = form?.get("returnTo") === "/login" ? "/login" : "/";

  const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", `${appOrigin()}${returnTo}`);
  if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);

  const response = NextResponse.redirect(logoutUrl, 303);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("authjs.")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}
