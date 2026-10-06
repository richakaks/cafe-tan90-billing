import { NextRequest, NextResponse } from "next/server";
import { addPurchases, bangkokToday, getOwedBack, getPurchaseInventoryMeta, getPurchaseSuggestions, getPurchases, getShoppingList, type PurchaseInput } from "@/lib/counter";
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
    const [purchases, owedBack, suggestions, inventory, shopping] = await Promise.all([
      getPurchases(from, to),
      getOwedBack(),
      getPurchaseSuggestions(),
      getPurchaseInventoryMeta(),
      getShoppingList(),
    ]);
    return NextResponse.json({ purchases, owedBack, suggestions, inventory, shopping });
  } catch (err) {
    console.error("getPurchases failed", err);
    return NextResponse.json({ error: "Could not load purchases." }, { status: 500 });
  }
}

// Body: { rows: [...], staffId } -- several lines at once (e.g. a Makro bill).
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ rows?: Record<string, unknown>[]; staffId?: string | null; shoppingIds?: number[] }>(req);
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
    const shoppingIds = Array.isArray(body.shoppingIds) ? body.shoppingIds.filter((n) => Number.isInteger(n)) : [];
    const { batchId, results } = await addPurchases(rows, body.staffId ?? null, shoppingIds);
    return NextResponse.json({ ok: true, batchId, added: results.filter((r) => r === "added").length });
  } catch (err) {
    console.error("addPurchases failed", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
