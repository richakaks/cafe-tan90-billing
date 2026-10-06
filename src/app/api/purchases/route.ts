import { NextRequest, NextResponse } from "next/server";
import { addPurchases, bangkokToday, getOwedBack, getPurchaseSuggestions, getPurchases, type PurchaseInput } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";
import { parsePurchase } from "./validate";

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const today = bangkokToday();
  const from = isIsoDate(sp.get("from")) ? sp.get("from")! : today;
  const to = isIsoDate(sp.get("to")) ? sp.get("to")! : from;
  try {
    const [purchases, owedBack, suggestions] = await Promise.all([getPurchases(from, to), getOwedBack(), getPurchaseSuggestions()]);
    return NextResponse.json({ purchases, owedBack, suggestions });
  } catch (err) {
    console.error("getPurchases failed", err);
    return NextResponse.json({ error: "Could not load purchases." }, { status: 500 });
  }
}

// Body: { rows: [...], staffId } -- several lines at once (e.g. a Makro bill).
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ rows?: Record<string, unknown>[]; staffId?: string | null }>(req);
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 200) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  const rows: PurchaseInput[] = [];
  for (let i = 0; i < body.rows.length; i++) {
    const { value, error } = parsePurchase(body.rows[i], false);
    if (error) return NextResponse.json({ error: body.rows.length > 1 ? `Line ${i + 1}: ${error}` : error }, { status: 400 });
    rows.push(value as PurchaseInput);
  }
  try {
    await addPurchases(rows, body.staffId ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("addPurchases failed", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
