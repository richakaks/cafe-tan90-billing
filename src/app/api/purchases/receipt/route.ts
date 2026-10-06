import { NextRequest, NextResponse } from "next/server";
import { ensureBatchForPurchase, receiptUrl, saveReceipt } from "@/lib/counter";
import { requireStaff } from "@/lib/requireStaff";

const MAX_BYTES = 6 * 1024 * 1024;

// POST multipart: file + (batchId | purchaseId). The browser shrinks the
// photo to a JPEG before sending it.
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "No photo." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large." }, { status: 400 });
    let batchId = String(form.get("batchId") ?? "");
    const purchaseId = Number(form.get("purchaseId"));
    if (!batchId && Number.isInteger(purchaseId) && purchaseId > 0) batchId = await ensureBatchForPurchase(purchaseId);
    if (!/^[0-9a-f-]{36}$/.test(batchId)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await saveReceipt(batchId, await file.arrayBuffer(), file.type || "image/jpeg");
    return NextResponse.json({ ok: true, batchId });
  } catch (err) {
    console.error("receipt upload failed", err);
    return NextResponse.json({ error: "Could not upload the photo." }, { status: 500 });
  }
}

// GET ?batch=<id> -> redirects to a short-lived link to the photo.
export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const batch = new URL(req.url).searchParams.get("batch") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(batch)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const url = await receiptUrl(batch);
    if (!url) return NextResponse.json({ error: "No photo for this purchase." }, { status: 404 });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("receiptUrl failed", err);
    return NextResponse.json({ error: "Could not open the photo." }, { status: 500 });
  }
}
