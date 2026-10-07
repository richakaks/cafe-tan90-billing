import { NextRequest, NextResponse } from "next/server";
import { CounterError, addOrderPayment, addOrderSplitPayment, bangkokToday } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";

// Pay-later settlement, a top-up, or a refund (negative amount).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ method?: string; amount?: number; cash?: number; online?: number; tendered?: number; receivedOn?: string; staffId?: string | null; note?: string }>(req);
  const tendered = Number(body?.tendered) > 0 ? Number(body?.tendered) : null;
  // Round 35: split = cash part + online part in one go.
  if (body?.method === "split") {
    const cash = Number(body.cash);
    const online = Number(body.online);
    if (!(cash > 0) || !(online > 0)) return NextResponse.json({ error: "Enter both the cash and the online part." }, { status: 400 });
    const day = isIsoDate(body.receivedOn) ? body.receivedOn : bangkokToday();
    try {
      await addOrderSplitPayment(id, cash, online, day, body.staffId ?? null, body.note?.trim() || null, tendered);
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
      console.error("addOrderSplitPayment failed", err);
      return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });
    }
  }
  if (!body || (body.method !== "cash" && body.method !== "online")) {
    return NextResponse.json({ error: "Pick Cash or Online." }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
  const receivedOn = isIsoDate(body.receivedOn) ? body.receivedOn : bangkokToday();
  try {
    await addOrderPayment(id, body.method, amount, receivedOn, body.staffId ?? null, body.note?.trim() || null, tendered);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("addOrderPayment failed", err);
    return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });
  }
}
