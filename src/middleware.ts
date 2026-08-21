import { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE_NAME, isValidStaffCookie } from "@/lib/auth";

// Runs in the Node.js runtime (not Edge) so lib/auth.ts can use node:crypto.
export const runtime = "nodejs";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(STAFF_COOKIE_NAME)?.value;
  if (isValidStaffCookie(cookie)) return NextResponse.next();

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/serve/:path*", "/admin/:path*"],
};
