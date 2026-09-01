import { NextResponse } from "next/server";
import { getServedOrders } from "@/lib/data";

export async function GET() {
  try {
    const orders = await getServedOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("getServedOrders failed", err);
    return NextResponse.json({ error: "Could not load orders awaiting payment." }, { status: 500 });
  }
}
