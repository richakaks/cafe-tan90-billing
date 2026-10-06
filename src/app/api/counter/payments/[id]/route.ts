import { NextRequest, NextResponse } from "next/server";
import { CounterError, deleteOrderPayment } from "@/lib/counter";
import { requireStaff } from "@/lib/requireStaff";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  const staffId = new URL(req.url).searchParams.get("staffId");
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId)) return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
  try {
    await deleteOrderPayment(paymentId, staffId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CounterError) return NextResponse.json({ error: err.friendlyMessage }, { status: 400 });
    console.error("deleteOrderPayment failed", err);
    return NextResponse.json({ error: "Could not remove the payment." }, { status: 500 });
  }
}
