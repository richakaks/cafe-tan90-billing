import { NextResponse } from "next/server";
import { resetAllOrders } from "@/lib/data";
import { describeError } from "@/lib/errorMessage";

export async function POST() {
  try {
    await resetAllOrders();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resetAllOrders failed", err);
    const detail = describeError(err);
    return NextResponse.json({ error: detail ? `Could not reset orders: ${detail}` : "Could not reset orders." }, { status: 500 });
  }
}
