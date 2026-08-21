import { NextRequest, NextResponse } from "next/server";
import { setMenuItemIngredient } from "@/lib/data";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const ingredientId = body.ingredientId;
  const qtyPerOrder = Number(body.qtyPerOrder);

  if (typeof ingredientId !== "string" || !ingredientId || Number.isNaN(qtyPerOrder) || qtyPerOrder <= 0) {
    return NextResponse.json({ error: "Pick an ingredient and a quantity greater than 0." }, { status: 400 });
  }

  try {
    await setMenuItemIngredient(code, ingredientId, qtyPerOrder);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("setMenuItemIngredient failed", err);
    return NextResponse.json({ error: "Could not link this ingredient." }, { status: 500 });
  }
}
