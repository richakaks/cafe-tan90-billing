import { NextRequest, NextResponse } from "next/server";
import { deletePurchase, updatePurchase } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";
import { parsePurchase } from "../validate";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const id = Number((await params).id);
  const body = await readJson<Record<string, unknown>>(req);
  if (!Number.isInteger(id) || !body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { value, error } = parsePurchase(body, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    await updatePurchase(id, value!);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("updatePurchase failed", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await deletePurchase(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deletePurchase failed", err);
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
