import { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/staff-login", req.url), { status: 303 });
  res.cookies.delete(STAFF_COOKIE_NAME);
  return res;
}
