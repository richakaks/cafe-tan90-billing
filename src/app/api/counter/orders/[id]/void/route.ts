import { NextRequest, NextResponse } from "next/server";
import { CounterError, voidCounterOrder } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ reason?: string; staffId?: string | null }>(req);
  const reason = body?.reason?.trim();
  if (!reason) return NextResponse.json({ error: "Say why the order is being voided." }, { status: 400 });
  try {
    await voidCounterOrder(id, reason, body?.staffId ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("voidCounterOrder failed", err);
    return NextResponse.json({ error: "Could not void the order." }, { status: 500 });
  }
}
