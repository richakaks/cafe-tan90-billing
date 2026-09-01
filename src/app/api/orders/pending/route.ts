import { NextResponse } from "next/server";
import { getPendingPreOrders } from "@/lib/data";

export async function GET() {
  try {
    const orders = await getPendingPreOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("getPendingPreOrders failed", err);
    return NextResponse.json({ error: "Could not load pre-orders." }, { status: 500 });
  }
}
