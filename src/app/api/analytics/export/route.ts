import { NextRequest, NextResponse } from "next/server";
import { getOrdersForExport } from "@/lib/data";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to date." }, { status: 400 });
  }

  try {
    const orders = await getOrdersForExport(from, to);
    const csv = toCsv(
      ["Order #", "Date", "Seat", "Type", "Status", "Items", "Gross", "Discount", "Net", "Coupon", "Payment", "Placed at"],
      orders.map((o) => {
        const gross = o.items.reduce((sum, it) => sum + it.qty * it.priceAtOrder, 0);
        const net = Math.max(0, gross - o.discountAmount);
        const items = o.items.map((it) => `${it.qty}x ${it.itemName}`).join("; ");
        return [
          o.dailyOrderNumber ?? "",
          o.orderDate ?? "",
          o.seatId ?? "",
          o.orderType,
          o.status,
          items,
          gross,
          o.discountAmount,
          net,
          o.couponCode ?? "",
          o.paymentMethod ?? "",
          new Date(o.createdAt).toISOString(),
        ];
      })
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tan90-orders_${from}_to_${to}.csv"`,
      },
    });
  } catch (err) {
    console.error("orders export failed", err);
    return NextResponse.json({ error: "Could not export orders." }, { status: 500 });
  }
}
