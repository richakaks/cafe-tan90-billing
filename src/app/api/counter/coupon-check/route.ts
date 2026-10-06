import { NextRequest, NextResponse } from "next/server";
import { bangkokToday } from "@/lib/counter";
import { db } from "@/lib/supabase";
import { requireStaff } from "@/lib/requireStaff";

// Lets the counter / Billing show a coupon's value, what's left on it and
// whether it has expired while the bill is being built. The real check
// still happens when the coupon is saved (attach_coupon_to_order()).
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Type a code." }, { status: 400 });
  const { data, error } = await db().from("coupons").select("code, value, batch:batch_id(expires_on)").eq("code", code).maybeSingle();
  if (error) {
    console.error("coupon-check failed", error);
    return NextResponse.json({ error: "Could not check the coupon." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ found: false });
  const { data: left, error: balErr } = await db().rpc("coupon_balance", { p_code: data.code });
  if (balErr) {
    console.error("coupon_balance failed", balErr);
    return NextResponse.json({ error: "Could not check the coupon." }, { status: 500 });
  }
  const batch = (Array.isArray(data.batch) ? data.batch[0] : data.batch) as { expires_on: string | null } | null;
  const expiresOn = batch?.expires_on ?? null;
  const balance = Math.max(0, Number(left ?? 0));
  return NextResponse.json({
    found: true,
    value: Number(data.value),
    balance,
    redeemed: balance <= 0.005,
    expiresOn,
    expired: !!expiresOn && bangkokToday() >= expiresOn,
  });
}
