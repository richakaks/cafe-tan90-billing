import { NextRequest, NextResponse } from "next/server";
import { CounterError, resolvePendingCoupon } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Fill in the code for a "code pending" coupon (validated now).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ code?: string; staffId?: string | null }>(req);
  const code = body?.code?.trim();
  if (!code) return NextResponse.json({ error: "Type the coupon code." }, { status: 400 });
  try {
    await resolvePendingCoupon(Number(id), code, body?.staffId ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("resolvePendingCoupon failed", err);
    return NextResponse.json({ error: "Could not save the coupon code." }, { status: 500 });
  }
}
