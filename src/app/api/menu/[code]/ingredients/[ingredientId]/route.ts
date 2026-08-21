import { NextRequest, NextResponse } from "next/server";
import { removeMenuItemIngredient } from "@/lib/data";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string; ingredientId: string }> }) {
  const { code, ingredientId } = await params;
  try {
    await removeMenuItemIngredient(code, ingredientId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("removeMenuItemIngredient failed", err);
    return NextResponse.json({ error: "Could not remove this ingredient link." }, { status: 500 });
  }
}
