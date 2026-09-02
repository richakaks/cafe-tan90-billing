import { NextResponse } from "next/server";
import { clearStockHistory } from "@/lib/data";

export async function POST() {
  try {
    await clearStockHistory();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("clearStockHistory failed", err);
    return NextResponse.json({ error: "Could not clear stock history." }, { status: 500 });
  }
}
