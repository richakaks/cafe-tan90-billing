import { NextRequest, NextResponse } from "next/server";
import { createCouponBatch, getCouponBatches } from "@/lib/data";

export async function GET() {
  try {
    const batches = await getCouponBatches();
    return NextResponse.json({ batches });
  } catch (err) {
    console.error("getCouponBatches failed", err);
    return NextResponse.json({ error: "Could not load coupon batches." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { buyerName?: string; couponValue?: number; codes?: string[]; totalCollected?: number; soldAt?: string; paid?: boolean; collected?: boolean; expiresOn?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const buyerName = body.buyerName?.trim();
  const couponValue = Number(body.couponValue);
  const codes = body.codes;
  const totalCollected = Number(body.totalCollected);
  // Round 26: optional -- lets the owner backdate a batch entered on the
  // site after the real sale happened. Falls back to the DB's now() default
  // when omitted or blank.
  const soldAt = typeof body.soldAt === "string" && body.soldAt.trim() ? body.soldAt.trim() : undefined;
  const paid = body.paid === true;
  const collected = body.collected === true;
  const expiresOn = typeof body.expiresOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expiresOn) ? body.expiresOn : null;

  if (!buyerName) {
    return NextResponse.json({ error: "Enter who bought these coupons." }, { status: 400 });
  }
  if (!couponValue || couponValue <= 0) {
    return NextResponse.json({ error: "Enter a value per coupon." }, { status: 400 });
  }
  if (!Array.isArray(codes) || codes.filter((c) => c.trim()).length === 0) {
    return NextResponse.json({ error: "Enter at least one coupon code." }, { status: 400 });
  }
  if (Number.isNaN(totalCollected) || totalCollected < 0) {
    return NextResponse.json({ error: "Enter the total amount collected." }, { status: 400 });
  }

  try {
    await createCouponBatch(buyerName, couponValue, codes, totalCollected, soldAt, paid, collected, expiresOn);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("createCouponBatch failed", err);
    const message = err instanceof Error && err.message.includes("duplicate key") ? "One of those coupon codes is already in use." : "Could not save this coupon batch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
