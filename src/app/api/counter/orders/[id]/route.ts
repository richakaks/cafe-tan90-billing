import { NextRequest, NextResponse } from "next/server";
import { CounterError, deleteVoidOrder, updateCounterOrder } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<Parameters<typeof updateCounterOrder>[1]>(req);
  if (!body || !Array.isArray(body.items)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await updateCounterOrder(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("updateCounterOrder failed", err);
    return NextResponse.json({ error: "Could not save the changes." }, { status: 500 });
  }
}

// Round 36: delete a voided order for good (only voided ones).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteVoidOrder(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("deleteVoidOrder failed", err);
    return NextResponse.json({ error: "Could not delete the order." }, { status: 500 });
  }
}
