import { NextRequest, NextResponse } from "next/server";
import { getSalesAnalytics } from "@/lib/data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to date." }, { status: 400 });
  }

  try {
    const analytics = await getSalesAnalytics(from, to);
    return NextResponse.json({ analytics });
  } catch (err) {
    console.error("getSalesAnalytics failed", err);
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }
}
