import { NextRequest, NextResponse } from "next/server";
import { CounterError, addOrderCoupon } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Add a coupon to an existing order: a real code (validated now) or a
// "code pending" amount to be filled in later.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ code?: string; pendingAmount?: number; staffId?: string | null }>(req);
  const code = body?.code?.trim() || null;
  const pending = body?.pendingAmount ? Number(body.pendingAmount) : null;
  if (!code && !(pending && pending > 0)) return NextResponse.json({ error: "Type the coupon code, or the amount if the code isn't to hand." }, { status: 400 });
  try {
    await addOrderCoupon(id, code, code ? null : pending, body?.staffId ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("addOrderCoupon failed", err);
    return NextResponse.json({ error: "Could not add the coupon." }, { status: 500 });
  }
}
