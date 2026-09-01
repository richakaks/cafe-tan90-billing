import { NextResponse } from "next/server";
import { getRecentStockAdjustments } from "@/lib/data";

export async function GET() {
  try {
    const adjustments = await getRecentStockAdjustments();
    return NextResponse.json({ adjustments });
  } catch (err) {
    console.error("getRecentStockAdjustments failed", err);
    return NextResponse.json({ error: "Could not load restock history." }, { status: 500 });
  }
}
