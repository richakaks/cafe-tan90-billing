import { NextRequest, NextResponse } from "next/server";
import { CouponError, redeemCoupon } from "@/lib/data";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Enter a coupon code." }, { status: 400 });
  }

  try {
    await redeemCoupon(id, code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CouponError) {
      return NextResponse.json({ error: err.friendlyMessage }, { status: 409 });
    }
    console.error("redeemCoupon failed", err);
    return NextResponse.json({ error: "Could not apply that coupon." }, { status: 500 });
  }
}
