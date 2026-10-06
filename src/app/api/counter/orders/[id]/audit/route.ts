import { NextRequest, NextResponse } from "next/server";
import { getOrderAudit } from "@/lib/counter";
import { requireStaff } from "@/lib/requireStaff";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json({ entries: await getOrderAudit(id) });
  } catch (err) {
    console.error("getOrderAudit failed", err);
    return NextResponse.json({ error: "Could not load the history." }, { status: 500 });
  }
}
