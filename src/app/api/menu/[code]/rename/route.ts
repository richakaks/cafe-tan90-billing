import { NextRequest, NextResponse } from "next/server";
import { renameMenuItemCode } from "@/lib/data";
import { describeError } from "@/lib/errorMessage";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const newCode = typeof body.newCode === "string" ? body.newCode.trim() : "";

  if (!newCode) {
    return NextResponse.json({ error: "New code can't be empty." }, { status: 400 });
  }

  try {
    await renameMenuItemCode(code, newCode);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("renameMenuItemCode failed", err);
    return NextResponse.json({ error: describeError(err) ?? "Could not change this item's code." }, { status: 500 });
  }
}
