import { NextRequest, NextResponse } from "next/server";
import { markOrdersPaid } from "@/lib/data";
import { payOrdersCash } from "@/lib/counter";
import type { PaymentMethod } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: { orderIds?: string[]; paymentMethod?: string; tendered?: number; staffId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderIds = body.orderIds;
  if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "No orders to mark paid." }, { status: 400 });
  }

  if (body.paymentMethod !== "cash" && body.paymentMethod !== "online") {
    return NextResponse.json({ error: "Pick how this bill was paid — Cash or Online." }, { status: 400 });
  }
  const paymentMethod: PaymentMethod = body.paymentMethod;

  try {
    // Round 39: cash with the amount handed over -> change recorded too.
    const tendered = Number(body.tendered);
    if (paymentMethod === "cash" && tendered > 0) await payOrdersCash(orderIds, tendered, body.staffId ?? null);
    else await markOrdersPaid(orderIds, paymentMethod);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("markOrdersPaid failed", err);
    return NextResponse.json({ error: "Could not mark this bill paid." }, { status: 500 });
  }
}
