import { NextRequest, NextResponse } from "next/server";
import { getLastStockCount, recordStockCount } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// "Record a full stock count": stamps the moment the shelves were counted.
// Purchases bought before it are treated as already included in the count
// and are never added to stock again.
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ last: await getLastStockCount() });
  } catch (err) {
    console.error("getLastStockCount failed", err);
    return NextResponse.json({ error: "Could not load." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ note?: string; staffId?: string | null }>(req);
  try {
    await recordStockCount(body?.note?.trim() || null, body?.staffId ?? null);
    return NextResponse.json({ ok: true, last: await getLastStockCount() });
  } catch (err) {
    console.error("recordStockCount failed", err);
    return NextResponse.json({ error: "Could not record the count." }, { status: 500 });
  }
}
