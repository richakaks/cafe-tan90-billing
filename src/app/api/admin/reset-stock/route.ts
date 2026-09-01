import { NextResponse } from "next/server";
import { resetAllStock } from "@/lib/data";

export async function POST() {
  try {
    await resetAllStock();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resetAllStock failed", err);
    return NextResponse.json({ error: "Could not reset stock." }, { status: 500 });
  }
}
