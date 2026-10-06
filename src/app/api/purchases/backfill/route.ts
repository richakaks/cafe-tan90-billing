import { NextRequest, NextResponse } from "next/server";
import { applyPurchaseBackfill, previewPurchaseBackfill } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";

// Add earlier purchases to stock. from = null means "since the last full
// stock count". Purchases covered by the latest count or already added are
// always skipped (see preview_purchase_backfill in schema.sql).
function range(from: unknown, to: unknown): { from: string | null; to: string | null } {
  return { from: isIsoDate(from) ? from : null, to: isIsoDate(to) ? to : null };
}

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const r = range(sp.get("from"), sp.get("to"));
  try {
    return NextResponse.json({ rows: await previewPurchaseBackfill(r.from, r.to) });
  } catch (err) {
    console.error("previewPurchaseBackfill failed", err);
    return NextResponse.json({ error: "Could not build the preview." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ from?: string; to?: string }>(req);
  const r = range(body?.from, body?.to);
  try {
    return NextResponse.json({ ok: true, added: await applyPurchaseBackfill(r.from, r.to) });
  } catch (err) {
    console.error("applyPurchaseBackfill failed", err);
    return NextResponse.json({ error: "Could not add them." }, { status: 500 });
  }
}
