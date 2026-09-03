import { NextResponse } from "next/server";
import { clearStockHistory } from "@/lib/data";
import { describeError } from "@/lib/errorMessage";

export async function POST() {
  try {
    await clearStockHistory();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("clearStockHistory failed", err);
    const detail = describeError(err);
    return NextResponse.json(
      { error: detail ? `Could not clear stock history: ${detail}` : "Could not clear stock history." },
      { status: 500 }
    );
  }
}
