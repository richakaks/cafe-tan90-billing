import { NextRequest, NextResponse } from "next/server";
import { bangkokToday, getCashDay, getFlaggedCashDays, getRecentCashDays, saveCashDay } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const d = new URL(req.url).searchParams.get("date");
  const date = isIsoDate(d) ? d : bangkokToday();
  try {
    const [day, recent, flagged] = await Promise.all([getCashDay(date), getRecentCashDays(), getFlaggedCashDays()]);
    return NextResponse.json({ day, recent, flagged });
  } catch (err) {
    console.error("getCashDay failed", err);
    return NextResponse.json({ error: "Could not load the cash balance." }, { status: 500 });
  }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ date?: string; opening?: unknown; closingCounted?: unknown; note?: string; staffId?: string | null }>(req);
  if (!body || !isIsoDate(body.date)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await saveCashDay(body.date, numOrNull(body.opening), numOrNull(body.closingCounted), body.note?.trim() || null, body.staffId ?? null);
    const [day, flagged] = await Promise.all([getCashDay(body.date), getFlaggedCashDays()]);
    return NextResponse.json({ ok: true, day, flagged });
  } catch (err) {
    console.error("saveCashDay failed", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
