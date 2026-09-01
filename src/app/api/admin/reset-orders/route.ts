import { NextResponse } from "next/server";
import { resetAllOrders } from "@/lib/data";

export async function POST() {
  try {
    await resetAllOrders();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resetAllOrders failed", err);
    return NextResponse.json({ error: "Could not reset orders." }, { status: 500 });
  }
}
