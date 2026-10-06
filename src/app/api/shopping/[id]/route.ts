import { NextRequest, NextResponse } from "next/server";
import { deleteShoppingItem, updateShoppingItem } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const id = Number((await params).id);
  const body = await readJson<{ done?: boolean; note?: string | null }>(req);
  if (!Number.isInteger(id) || !body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await updateShoppingItem(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("updateShoppingItem failed", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await deleteShoppingItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deleteShoppingItem failed", err);
    return NextResponse.json({ error: "Could not remove." }, { status: 500 });
  }
}
