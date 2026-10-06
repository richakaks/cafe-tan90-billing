import { NextRequest, NextResponse } from "next/server";
import { setDayLocked } from "@/lib/counter";
import { isIsoDate, readJson, requireStaff } from "@/lib/requireStaff";

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ date?: string; locked?: boolean; staffId?: string | null }>(req);
  if (!body || !isIsoDate(body.date) || typeof body.locked !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    await setDayLocked(body.date, body.locked, body.staffId ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("setDayLocked failed", err);
    return NextResponse.json({ error: "Could not change the lock." }, { status: 500 });
  }
}
