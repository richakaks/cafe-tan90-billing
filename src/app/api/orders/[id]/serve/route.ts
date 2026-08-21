import { NextRequest, NextResponse } from "next/server";
import { markOrderServed } from "@/lib/data";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await markOrderServed(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("markOrderServed failed", err);
    return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
  }
}
