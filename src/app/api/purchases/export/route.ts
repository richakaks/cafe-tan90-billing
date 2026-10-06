import { NextRequest, NextResponse } from "next/server";
import { getPurchases } from "@/lib/counter";
import { toCsv } from "@/lib/csv";
import { isIsoDate, requireStaff } from "@/lib/requireStaff";

const VIA_LABEL = { drawer: "Cash (drawer)", online: "Online", own_pocket: "Own pocket" } as const;

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!isIsoDate(from) || !isIsoDate(to)) return NextResponse.json({ error: "Missing dates." }, { status: 400 });
  try {
    const rows = await getPurchases(from, to);
    const csv = toCsv(
      ["Date", "Item", "Brand", "Amount", "Unit", "Price", "Paid", "Who paid", "Paid back on", "Paid back from", "Note"],
      rows.map((r) => [
        r.purchaseDate,
        r.item,
        r.brand ?? "",
        r.quantity ?? "",
        r.unit ?? "",
        r.price,
        VIA_LABEL[r.paidVia],
        r.paidBy ?? "",
        r.reimbursedOn ?? "",
        r.reimbursedVia ? VIA_LABEL[r.reimbursedVia] : "",
        r.note ?? "",
      ])
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tan90-purchases_${from}_to_${to}.csv"`,
      },
    });
  } catch (err) {
    console.error("purchases export failed", err);
    return NextResponse.json({ error: "Could not export." }, { status: 500 });
  }
}
