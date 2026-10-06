import { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE_NAME, isValidStaffCookie } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(STAFF_COOKIE_NAME)?.value;
  if (isValidStaffCookie(cookie)) return NextResponse.next();

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/serve/:path*", "/billing/:path*", "/admin/:path*", "/counter/:path*", "/cash/:path*", "/purchases/:path*"],
};
