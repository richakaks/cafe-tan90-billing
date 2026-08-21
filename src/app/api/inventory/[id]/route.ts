import { NextRequest, NextResponse } from "next/server";
import { adjustIngredientStock, updateIngredientThreshold } from "@/lib/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  try {
    if (typeof body.delta === "number" && body.delta !== 0) {
      await adjustIngredientStock(id, body.delta);
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
