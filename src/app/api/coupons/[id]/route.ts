import { NextRequest, NextResponse } from "next/server";
import { updateCouponBatch } from "@/lib/data";

// Round 26: lets /admin/coupons correct a batch's sale date after the fact,
// and toggle paid / collected independently as those actually happen.
// Round 26 follow-up: also lets the buyer name / value each / total
// collected be corrected via the row's "Edit" button.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { soldAt?: string; paid?: boolean; collected?: boolean; buyerName?: string; couponValue?: number; totalCollected?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const updates: { soldAt?: string; paid?: boolean; collected?: boolean; buyerName?: string; couponValue?: number; totalCollected?: number } = {};
  if (typeof body.soldAt === "string" && body.soldAt.trim()) updates.soldAt = body.soldAt.trim();
  if (typeof body.paid === "boolean") updates.paid = body.paid;
  if (typeof body.collected === "boolean") updates.collected = body.collected;
  if (typeof body.buyerName === "string" && body.buyerName.trim()) updates.buyerName = body.buyerName.trim();
  if (typeof body.couponValue === "number" && body.couponValue > 0) updates.couponValue = body.couponValue;
  if (typeof body.totalCollected === "number" && body.totalCollected >= 0) updates.totalCollected = body.totalCollected;

  try {
    await updateCouponBatch(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("updateCouponBatch failed", err);
    return NextResponse.json({ error: "Could not update this coupon batch." }, { status: 500 });
  }
}
