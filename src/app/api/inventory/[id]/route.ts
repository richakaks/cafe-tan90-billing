import { NextRequest, NextResponse } from "next/server";
import { adjustIngredientStock, updateIngredientThreshold, updateIngredient, deleteIngredient } from "@/lib/data";

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

    // Round 18's "Edit ingredient" fields -- name/unit/brand and, per the
    // owner's explicit choice, a direct current-stock correction (routed
    // through updateIngredient -> adjustIngredientStock so it still logs).
    const edits: { name?: string; unit?: string; brand?: string | null; currentStock?: number; kind?: "batch_prep" | "raw" | "consumable" } = {};
    if (typeof body.name === "string" && body.name.trim()) edits.name = body.name.trim();
    if (typeof body.unit === "string" && body.unit.trim()) edits.unit = body.unit.trim();
    if (body.brand !== undefined) {
      edits.brand = typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null;
    }
    if (typeof body.currentStock === "number" && body.currentStock >= 0) edits.currentStock = body.currentStock;
    if (body.kind === "batch_prep" || body.kind === "raw" || body.kind === "consumable") edits.kind = body.kind;
    if (Object.keys(edits).length > 0) await updateIngredient(id, edits);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("inventory update failed", err);
    return NextResponse.json({ error: "Could not update this ingredient (maybe that name is already taken?)." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteIngredient(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deleteIngredient failed", err);
    return NextResponse.json({ error: "Could not delete this ingredient." }, { status: 500 });
  }
}
