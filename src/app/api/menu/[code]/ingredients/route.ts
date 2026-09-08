import { NextRequest, NextResponse } from "next/server";
import { setMenuItemIngredient } from "@/lib/data";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const ingredientId = body.ingredientId;
  const qtyPerOrder = Number(body.qtyPerOrder);
  // Round 22: typable display-only unit override. Absent/undefined leaves an
  // existing label untouched; an explicit empty string is treated as "clear
  // it" (stored as null), same as leaving the field blank in the UI.
  const unitLabel: string | null | undefined =
    body.unitLabel === undefined ? undefined : (body.unitLabel || "").trim() || null;

  if (typeof ingredientId !== "string" || !ingredientId || Number.isNaN(qtyPerOrder) || qtyPerOrder <= 0) {
    return NextResponse.json({ error: "Pick an ingredient and a quantity greater than 0." }, { status: 400 });
  }

  try {
    await setMenuItemIngredient(code, ingredientId, qtyPerOrder, unitLabel);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("setMenuItemIngredient failed", err);
    return NextResponse.json({ error: "Could not link this ingredient." }, { status: 500 });
  }
}
