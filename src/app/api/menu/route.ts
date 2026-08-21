import { NextRequest, NextResponse } from "next/server";
import { upsertMenuItem } from "@/lib/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, category, price, active } = body ?? {};

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
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("upsertMenuItem failed", err);
    return NextResponse.json({ error: "Could not save this menu item." }, { status: 500 });
  }
}
