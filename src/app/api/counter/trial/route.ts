import { NextRequest, NextResponse } from "next/server";
import { clearTrialOrders, getTrialOrders, placeCounterOrder } from "@/lib/counter";
import { db } from "@/lib/supabase";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Round 33: practice orders. GET lists them, POST makes a sample one (the
// serving screen's "Add trial order" button), DELETE clears them all.
// They never count in sales, cash, analytics or stock.
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ orders: await getTrialOrders() });
  } catch (err) {
    console.error("getTrialOrders failed", err);
    return NextResponse.json({ error: "Could not load trial orders." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ staffId?: string | null }>(req);
  try {
    // Two random items from the active menu, one of them takeaway, so the
    // serving screen shows a realistic order.
    const { data, error } = await db().from("menu_items").select("code").eq("active", true);
    if (error) throw error;
    const codes = (data ?? []).map((m) => m.code as string).sort(() => Math.random() - 0.5).slice(0, 2);
    if (codes.length === 0) return NextResponse.json({ error: "The menu is empty." }, { status: 400 });
    const result = await placeCounterOrder(
      {
        clientKey: `trial-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        clientCreatedAt: new Date().toISOString(),
        staffId: body?.staffId ?? null,
        kind: "walk_in",
        customerLabel: "Trial",
        trial: true,
        items: codes.map((code, i) => ({ code, qty: i === 0 ? 2 : 1, fulfillmentType: i === 0 ? "dine_in" : "takeaway" })),
        payments: [],
      },
      false
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error("trial order failed", err);
    return NextResponse.json({ error: "Could not create a trial order." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, cleared: await clearTrialOrders() });
  } catch (err) {
    console.error("clearTrialOrders failed", err);
    return NextResponse.json({ error: "Could not clear trial orders." }, { status: 500 });
  }
}
