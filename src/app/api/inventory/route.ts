import { NextRequest, NextResponse } from "next/server";
import { createIngredient } from "@/lib/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, unit, currentStock, lowStockThreshold, brand, kind } = body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof unit !== "string" || !unit.trim()) {
    return NextResponse.json({ error: "Name and unit are required." }, { status: 400 });
  }

  const trimmedBrand = typeof brand === "string" && brand.trim() ? brand.trim() : null;
  const ingredientKind = kind === "batch_prep" || kind === "consumable" || kind === "supply" ? kind : "raw";

  try {
    const created = await createIngredient(
      name.trim(),
      unit.trim(),
      Number(currentStock) || 0,
      Number(lowStockThreshold) || 0,
      trimmedBrand,
      ingredientKind,
    );
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("createIngredient failed", err);
    return NextResponse.json({ error: "Could not create ingredient (maybe the name already exists?)." }, { status: 500 });
  }
}
