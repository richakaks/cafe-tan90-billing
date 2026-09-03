import { NextRequest, NextResponse } from "next/server";
import { adjustIngredientStock, updateIngredientThreshold } from "@/lib/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  try {
    if (typeof body.delta === "number" && body.delta !== 0) {
      const pricePaid = typeof body.pricePaid === "number" && body.pricePaid >= 0 ? body.pricePaid : null;
      await adjustIngredientStock(id, body.delta, pricePaid);
    }
    if (typeof body.lowStockThreshold === "number") {
      await updateIngredientThreshold(id, body.lowStockThreshold);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("inventory update failed", err);
    return NextResponse.json({ error: "Could not update this ingredient." }, { status: 500 });
  }
}
