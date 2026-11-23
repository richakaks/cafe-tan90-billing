import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getTakeawayFee } from "@/lib/data";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Round 42: the takeaway charge per takeaway item (owner sets it on the Menu
// page). Stored as the price of the hidden TK-FEE menu item; orders keep the
// amount they were sold at.
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  return NextResponse.json({ amount: await getTakeawayFee() });
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ amount?: number }>(req);
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000) {
    return NextResponse.json({ error: "Enter an amount (0 turns the charge off)." }, { status: 400 });
  }
  const { error } = await db().from("menu_items").update({ price: amount, active: false }).eq("code", "TK-FEE");
  if (error) {
    console.error("takeaway fee update failed", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, amount });
}
