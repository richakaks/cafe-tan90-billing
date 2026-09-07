import { NextRequest, NextResponse } from "next/server";
import { deleteMenuItem } from "@/lib/data";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    await deleteMenuItem(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deleteMenuItem failed", err);
    return NextResponse.json({ error: "Could not delete this item." }, { status: 500 });
  }
}
