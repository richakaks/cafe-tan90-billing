import { NextRequest, NextResponse } from "next/server";
import { reorderMenuItems } from "@/lib/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderedCodes } = body ?? {};

  if (!Array.isArray(orderedCodes) || orderedCodes.length === 0 || orderedCodes.some((c) => typeof c !== "string")) {
    return NextResponse.json({ error: "orderedCodes must be a non-empty array of item codes." }, { status: 400 });
  }

  try {
    await reorderMenuItems(orderedCodes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reorderMenuItems failed", err);
    return NextResponse.json({ error: "Could not save the new order." }, { status: 500 });
  }
}
