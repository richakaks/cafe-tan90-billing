import { NextRequest, NextResponse } from "next/server";
import { setMenuItemActive } from "@/lib/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();

  try {
    await setMenuItemActive(code, Boolean(body.active));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("setMenuItemActive failed", err);
    return NextResponse.json({ error: "Could not update this item." }, { status: 500 });
  }
}
