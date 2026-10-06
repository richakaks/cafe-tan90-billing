import { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE_NAME, isValidStaffCookie } from "./auth";

// Round 32: the counter / cash API routes check the staff session cookie
// themselves (src/proxy.ts only guards pages). Returns a 401 response to
// send back when the caller isn't logged in, or null when they are.
export function requireStaff(req: NextRequest): NextResponse | null {
  if (isValidStaffCookie(req.cookies.get(STAFF_COOKIE_NAME)?.value)) return null;
  return NextResponse.json({ error: "Your staff login has expired. Log in again.", code: "unauthorized" }, { status: 401 });
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
