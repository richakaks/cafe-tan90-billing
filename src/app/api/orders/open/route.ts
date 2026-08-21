import { NextResponse } from "next/server";
import { getOpenOrders } from "@/lib/data";

export async function GET() {
  try {
    const orders = await getOpenOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("getOpenOrders failed", err);
    return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  }
}
