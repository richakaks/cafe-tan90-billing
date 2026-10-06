import { NextRequest, NextResponse } from "next/server";
import { addStaff, getStaff } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const all = new URL(req.url).searchParams.get("all") === "1";
  try {
    return NextResponse.json({ staff: await getStaff(all) });
  } catch (err) {
    console.error("getStaff failed", err);
    return NextResponse.json({ error: "Could not load the staff list." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ name?: string }>(req);
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "Type a name." }, { status: 400 });
  try {
    await addStaff(name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("addStaff failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add that name." }, { status: 400 });
  }
}
