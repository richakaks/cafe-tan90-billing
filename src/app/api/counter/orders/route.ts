import { NextRequest, NextResponse } from "next/server";
import { placeCounterOrder, type CounterOrderInput, type CounterSyncResult } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Takes a batch so a tablet coming back online can send its whole offline
// queue in one request. Each order carries its own clientKey, so a retry of
// an order that already reached the server returns the existing order
// instead of creating a duplicate. Orders are processed one at a time, in
// the order sent, so daily numbers follow the order they were taken in.
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ orders?: CounterOrderInput[]; fromQueue?: boolean }>(req);
  if (!body || !Array.isArray(body.orders) || body.orders.length === 0 || body.orders.length > 200) {
    return NextResponse.json({ error: "No orders sent." }, { status: 400 });
  }

  const results: CounterSyncResult[] = [];
  for (const order of body.orders) {
    if (!order || typeof order.clientKey !== "string" || !Array.isArray(order.items)) {
      results.push({ clientKey: String(order?.clientKey ?? ""), ok: false, permanent: true, error: "This order is incomplete." });
      continue;
    }
    try {
      // An order replayed from the offline queue must never be lost over a
      // coupon problem: a code that can't be accepted any more is parked as
      // "code pending" (with the code staff typed) instead of failing.
      results.push(await placeCounterOrder(order, body.fromQueue === true));
    } catch (err) {
      console.error("placeCounterOrder failed", err);
      results.push({ clientKey: order.clientKey, ok: false, permanent: false, error: "Server error — will retry." });
    }
  }
  return NextResponse.json({ results });
}
