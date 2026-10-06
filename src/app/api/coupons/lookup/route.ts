import { NextRequest, NextResponse } from "next/server";
import { getCouponDetail } from "@/lib/counter";
import { requireStaff } from "@/lib/requireStaff";

// Round 35: coupon lookup (value, what's left, expiry, bills it was used on).
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Type a code." }, { status: 400 });
  try {
    const detail = await getCouponDetail(code);
    if (!detail) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, coupon: detail });
  } catch (err) {
    console.error("getCouponDetail failed", err);
    return NextResponse.json({ error: "Could not look up that coupon." }, { status: 500 });
  }
}
