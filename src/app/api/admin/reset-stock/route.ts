import { NextResponse } from "next/server";
import { resetAllStock } from "@/lib/data";
import { describeError } from "@/lib/errorMessage";

export async function POST() {
  try {
    await resetAllStock();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resetAllStock failed", err);
    const detail = describeError(err);
    return NextResponse.json({ error: detail ? `Could not reset stock: ${detail}` : "Could not reset stock." }, { status: 500 });
  }
}
