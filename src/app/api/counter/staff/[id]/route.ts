import { NextRequest, NextResponse } from "next/server";
import { updateStaff } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ name?: string; active?: boolean }>(req);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (body.name !== undefined && !body.name.trim()) return NextResponse.json({ error: "Type a name." }, { status: 400 });
  try {
    await updateStaff(id, { name: body.name, active: body.active });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("updateStaff failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update." }, { status: 400 });
  }
}
