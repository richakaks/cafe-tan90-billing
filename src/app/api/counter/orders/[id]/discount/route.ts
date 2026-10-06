import { NextRequest, NextResponse } from "next/server";
import { CounterError, setOrderDiscount } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Round 35: set / change / clear the discount on any order (Billing + counter).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ pct?: number | null; amount?: number | null; note?: string; staffId?: string | null }>(req);
  const pct = body?.pct ? Number(body.pct) : null;
  const amount = body?.amount ? Number(body.amount) : null;
  if ((pct !== null && !(pct >= 0 && pct <= 100)) || (amount !== null && !(amount >= 0))) {
    return NextResponse.json({ error: "Enter a valid discount." }, { status: 400 });
  }
  if ((pct || amount) && !body?.note?.trim()) {
    return NextResponse.json({ error: "Say why (e.g. staff meal, regular, complaint)." }, { status: 400 });
  }
  try {
    await setOrderDiscount(id, pct, amount, body?.note?.trim() || null, body?.staffId ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("setOrderDiscount failed", err);
    return NextResponse.json({ error: "Could not save the discount." }, { status: 500 });
  }
}
