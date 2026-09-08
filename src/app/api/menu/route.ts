import { NextRequest, NextResponse } from "next/server";
import { upsertMenuItem } from "@/lib/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, category, price, active, yieldServings, description } = body ?? {};

  if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Code and name are required." }, { status: 400 });
  }
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    return NextResponse.json({ error: "Price must be a non-negative number." }, { status: 400 });
  }

  try {
    await upsertMenuItem({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category: (category || "Other").trim(),
      price: numericPrice,
      active: active !== false,
      // Fixes a pre-existing gap: this route never forwarded yieldServings
      // to upsertMenuItem, so a Yield edit from /admin/menu's details grid
      // silently never persisted even though the UI showed it saving.
      ...(typeof yieldServings === "number" && yieldServings > 0 ? { yieldServings } : {}),
      ...(description !== undefined ? { description: typeof description === "string" ? (description.trim() || null) : null } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("upsertMenuItem failed", err);
    return NextResponse.json({ error: "Could not save this menu item." }, { status: 500 });
  }
}
