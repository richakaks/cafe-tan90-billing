import { NextRequest, NextResponse } from "next/server";
import { FulfillError, fulfillPreOrder } from "@/lib/data";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await fulfillPreOrder(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FulfillError) {
      return NextResponse.json({ error: err.friendlyMessage }, { status: 409 });
    }
    console.error("fulfillPreOrder failed", err);
    return NextResponse.json({ error: "Could not fulfill this pre-order." }, { status: 500 });
  }
}
