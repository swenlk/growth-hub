import { NextResponse } from "next/server";

import { canAccess, homeForRoles, isPublicPath } from "@/lib/access";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 uses proxy.ts instead of middleware.ts.
 * tenantId is never taken from the request. Role checks use the session only.
 */
export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const roles = request.auth?.roles ?? [];
  const signedIn = Boolean(request.auth?.sub) && roles.length > 0;

  if (!signedIn) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (!canAccess(pathname, roles)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(homeForRoles(roles), request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // The course upload is omitted so Next does not copy the video into memory.
  // POST /api/admin/courses checks the session itself. Other routes stay gated here.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/admin/courses(?:/[^/]+)?$).*)"],
};
