import { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE_MAX_AGE, STAFF_COOKIE_NAME, checkPin, staffCookieValue } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const pin = String(form.get("pin") ?? "");
  const next = String(form.get("next") ?? "/serve");
  const safeNext = next.startsWith("/") ? next : "/serve";

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", safeNext);

  if (!pin || !checkPin(pin)) {
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(safeNext, req.url), { status: 303 });
  res.cookies.set(STAFF_COOKIE_NAME, staffCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STAFF_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
