import { NextRequest, NextResponse } from "next/server";
import { OrderError, placeOrder } from "@/lib/data";
import type { CartItem } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: { seatId?: string; items?: CartItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const seatId = body.seatId;
  const items = body.items;

  if (!seatId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
  }

  for (const item of items) {
    if (typeof item.code !== "string" || typeof item.qty !== "number" || item.qty <= 0) {
      return NextResponse.json({ error: "Invalid item in basket." }, { status: 400 });
    }
    if (item.fulfillmentType !== "dine_in" && item.fulfillmentType !== "takeaway") {
      return NextResponse.json({ error: "Please choose Dine In or Takeaway for each item." }, { status: 400 });
    }
  }

  try {
    const order = await placeOrder(seatId, items);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.friendlyMessage }, { status: 409 });
    }
    console.error("place_order failed", err);
    return NextResponse.json({ error: "Something went wrong placing your order. Please try again." }, { status: 500 });
  }
}
