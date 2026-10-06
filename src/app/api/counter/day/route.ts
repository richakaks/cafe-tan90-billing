import { NextRequest, NextResponse } from "next/server";
import { bangkokToday, getCounterDay, getCounterOpenItems } from "@/lib/counter";
import { isIsoDate, requireStaff } from "@/lib/requireStaff";

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const d = new URL(req.url).searchParams.get("date");
  const date = isIsoDate(d) ? d : bangkokToday();
  try {
    const [day, open] = await Promise.all([getCounterDay(date), getCounterOpenItems()]);
    return NextResponse.json({ day, open });
  } catch (err) {
    console.error("getCounterDay failed", err);
    return NextResponse.json({ error: "Could not load the day." }, { status: 500 });
  }
}
