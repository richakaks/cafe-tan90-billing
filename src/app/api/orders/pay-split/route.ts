import { NextRequest, NextResponse } from "next/server";
import { CounterError, payOrdersSplit } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Round 35: Billing -> Split. `cash` is the cash part for the whole set of
// orders; the rest of each bill is recorded as online.
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ orderIds?: string[]; cash?: number; tendered?: number; staffId?: string | null }>(req);
  const orderIds = Array.isArray(body?.orderIds) ? body.orderIds.filter((x) => typeof x === "string") : [];
  const cash = Number(body?.cash);
  if (orderIds.length === 0) return NextResponse.json({ error: "No orders given." }, { status: 400 });
  if (!Number.isFinite(cash) || cash < 0) return NextResponse.json({ error: "Enter the cash part." }, { status: 400 });
  try {
    await payOrdersSplit(orderIds, cash, body?.staffId ?? null, Number(body?.tendered) > 0 ? Number(body?.tendered) : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("payOrdersSplit failed", err);
    return NextResponse.json({ error: "Could not record the split payment." }, { status: 500 });
  }
}
