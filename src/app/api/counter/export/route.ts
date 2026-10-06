import { NextRequest, NextResponse } from "next/server";
import { getCounterDay } from "@/lib/counter";
import { toCsv } from "@/lib/csv";
import { isIsoDate, requireStaff } from "@/lib/requireStaff";

// One day's orders as CSV (opens in Excel), in the same shape as the old
// ledger: one row per order with the online / cash / coupon split.
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const date = new URL(req.url).searchParams.get("date");
  if (!isIsoDate(date)) return NextResponse.json({ error: "Missing date." }, { status: 400 });
  try {
    const { orders, summary } = await getCounterDay(date);
    const rows = orders.map((o) => {
      const online = o.payments.filter((p) => p.method === "online").reduce((s, p) => s + p.amount, 0);
      const cash = o.payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
      const coupon = o.coupons.reduce((s, c) => s + c.amount, 0);
      return [
        o.dailyOrderNumber ?? "",
        o.source === "counter" ? "Counter" : "QR",
        o.status === "void" ? `VOID (${o.voidReason ?? ""})` : o.status,
        new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(o.createdAt)),
        o.customerLabel ?? o.seatId ?? "",
        o.staffName ?? "",
        o.items.map((it) => `${it.qty}x ${it.itemName}${it.fulfillmentType === "takeaway" ? " (takeaway)" : ""}${it.note ? ` [${it.note}]` : ""}`).join("; "),
        o.gross,
        o.manualDiscountAmount,
        coupon,
        o.coupons.map((c) => c.code ?? "code pending").join(" "),
        o.status === "void" ? 0 : o.net,
        online,
        cash,
        o.status === "void" ? 0 : Math.max(0, o.outstanding),
      ];
    });
    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", "", "", summary.gross, "", summary.couponTotal, "", summary.net, summary.onlineReceived, summary.cashReceived, summary.outstanding]);
    const csv = toCsv(
      ["Order #", "Source", "Status", "Time", "Customer / seat", "Taken by", "Items", "Gross", "Discount", "Coupon", "Coupon codes", "Net", "Online", "Cash", "Unpaid"],
      rows
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tan90-day_${date}.csv"`,
      },
    });
  } catch (err) {
    console.error("counter export failed", err);
    return NextResponse.json({ error: "Could not export." }, { status: 500 });
  }
}
