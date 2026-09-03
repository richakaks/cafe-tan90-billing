import { NextRequest, NextResponse } from "next/server";
import { getStockAdjustmentsInRange } from "@/lib/data";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to date." }, { status: 400 });
  }

  try {
    const adjustments = await getStockAdjustmentsInRange(from, to);
    const csv = toCsv(
      ["Date", "Ingredient", "Change", "Resulting stock", "Price paid (THB)"],
      adjustments.map((a) => [
        new Date(a.createdAt).toISOString(),
        a.ingredientName,
        a.delta,
        a.resultingStock,
        a.pricePaid ?? "",
      ])
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tan90-stock-history_${from}_to_${to}.csv"`,
      },
    });
  } catch (err) {
    console.error("stock history export failed", err);
    return NextResponse.json({ error: "Could not export history." }, { status: 500 });
  }
}
