import { NextRequest, NextResponse } from "next/server";
import { getSalesStockMeta, setSalesDeduct } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Round 38: the two "sales take stock off" switches (QR / counter).
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await getSalesStockMeta());
  } catch (err) {
    console.error("getSalesStockMeta failed", err);
    return NextResponse.json({ error: "Could not load the stock switches." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ source?: string; on?: boolean }>(req);
  if (!body || (body.source !== "qr" && body.source !== "counter") || typeof body.on !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    await setSalesDeduct(body.source, body.on);
    return NextResponse.json(await getSalesStockMeta());
  } catch (err) {
    console.error("setSalesDeduct failed", err);
    return NextResponse.json({ error: "Could not change the switch." }, { status: 500 });
  }
}
