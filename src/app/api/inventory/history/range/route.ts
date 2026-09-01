import { NextRequest, NextResponse } from "next/server";
import { getStockAdjustmentsInRange } from "@/lib/data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to date." }, { status: 400 });
  }

  try {
    const adjustments = await getStockAdjustmentsInRange(from, to);
    return NextResponse.json({ adjustments });
  } catch (err) {
    console.error("getStockAdjustmentsInRange failed", err);
    return NextResponse.json({ error: "Could not load history." }, { status: 500 });
  }
}
