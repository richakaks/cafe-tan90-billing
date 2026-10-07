import { NextRequest, NextResponse } from "next/server";
import { getCashDay, getFlaggedCashDays, resolveCashDay } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";

// Round 39: mark a flagged drawer difference as resolved, with a reason.
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ date?: string; reason?: string; staffId?: string | null }>(req);
  if (!body || !isIsoDate(body.date)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const reason = body.reason?.trim();
  if (!reason) return NextResponse.json({ error: "Write what happened (the reason)." }, { status: 400 });
  try {
    await resolveCashDay(body.date, reason, body.staffId ?? null);
    const [day, flagged] = await Promise.all([getCashDay(body.date), getFlaggedCashDays()]);
    return NextResponse.json({ ok: true, day, flagged });
  } catch (err) {
    console.error("resolveCashDay failed", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
