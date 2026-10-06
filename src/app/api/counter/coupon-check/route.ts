import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireStaff } from "@/lib/requireStaff";

// Lets the counter show a coupon's value (and whether it's already used)
// while the order is being built. The real check still happens when the
// order is saved, inside place_counter_order().
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Type a code." }, { status: 400 });
  const { data, error } = await db().from("coupons").select("code, value, redeemed").eq("code", code).maybeSingle();
  if (error) {
    console.error("coupon-check failed", error);
    return NextResponse.json({ error: "Could not check the coupon." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, value: Number(data.value), redeemed: data.redeemed });
}
