import { NextRequest, NextResponse } from "next/server";
import { CounterError, applySalesBackfill, previewSalesBackfill } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";

// Round 38: take stock off for orders placed while a switch was off.
// No from/to = since the latest full stock count.
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const source = sp.get("source");
  if (source !== "qr" && source !== "counter") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const from = sp.get("from");
  const to = sp.get("to");
  try {
    const rows = await previewSalesBackfill(source, isIsoDate(from) ? from : null, isIsoDate(to) ? to : null);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("previewSalesBackfill failed", err);
    return NextResponse.json({ error: "Could not load the preview." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ source?: string; from?: string; to?: string }>(req);
  if (!body || (body.source !== "qr" && body.source !== "counter")) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const count = await applySalesBackfill(body.source, isIsoDate(body.from) ? body.from : null, isIsoDate(body.to) ? body.to : null);
    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof CounterError && err.code === "no_stock_count") {
      return NextResponse.json({ error: "Record a full stock count on Inventory first." }, { status: 400 });
    }
    console.error("applySalesBackfill failed", err);
    return NextResponse.json({ error: "Could not take the stock off." }, { status: 500 });
  }
}
