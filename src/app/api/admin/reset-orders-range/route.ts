import { NextRequest, NextResponse } from "next/server";
import { resetOrdersInRange } from "@/lib/data";
import { describeError } from "@/lib/errorMessage";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const from = body?.from;
  const to = body?.to;

  if (typeof from !== "string" || typeof to !== "string" || !from || !to) {
    return NextResponse.json({ error: "Missing from/to date." }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "\"From\" must be on or before \"To\"." }, { status: 400 });
  }

  try {
    await resetOrdersInRange(from, to);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resetOrdersInRange failed", err);
    const detail = describeError(err);
    return NextResponse.json(
      { error: detail ? `Could not reset orders in that range: ${detail}` : "Could not reset orders in that range." },
      { status: 500 }
    );
  }
}
