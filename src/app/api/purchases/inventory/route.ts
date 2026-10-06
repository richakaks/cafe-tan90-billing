import { NextRequest, NextResponse } from "next/server";
import { setPurchasesToInventory } from "@/lib/counter";
import { readJson, requireStaff } from "@/lib/requireStaff";

// Owner switch: do purchases add to inventory stock?
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ on?: boolean }>(req);
  if (typeof body?.on !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await setPurchasesToInventory(body.on);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("setPurchasesToInventory failed", err);
    return NextResponse.json({ error: "Could not change the setting." }, { status: 500 });
  }
}
