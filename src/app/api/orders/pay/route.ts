import { NextRequest, NextResponse } from "next/server";
import { markOrdersPaid } from "@/lib/data";

export async function POST(req: NextRequest) {
  let body: { orderIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderIds = body.orderIds;
  if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "No orders to mark paid." }, { status: 400 });
  }

  try {
    await markOrdersPaid(orderIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("markOrdersPaid failed", err);
    return NextResponse.json({ error: "Could not mark this bill paid." }, { status: 500 });
  }
}
