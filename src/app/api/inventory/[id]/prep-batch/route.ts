import { NextRequest, NextResponse } from "next/server";
import { PrepBatchError, prepBatch } from "@/lib/data";

// Round 23: staff records "I just prepped a batch of this primary" from
// /admin/inventory. Atomically deducts the primary's own raw ingredients
// (its nested bill-of-materials, scaled to the batch qty) and credits the
// batch qty onto the primary's own stock -- see prep_batch() in schema.sql.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const batchQty = Number(body?.batchQty);

  if (!Number.isFinite(batchQty) || batchQty <= 0) {
    return NextResponse.json({ error: "Enter a batch quantity greater than 0." }, { status: 400 });
  }

  try {
    const result = await prepBatch(id, batchQty);
    return NextResponse.json({ ok: true, newStock: result.newStock });
  } catch (err) {
    if (err instanceof PrepBatchError) {
      return NextResponse.json({ error: err.friendlyMessage }, { status: 409 });
    }
    console.error("prepBatch failed", err);
    return NextResponse.json({ error: "Could not record this batch prep." }, { status: 500 });
  }
}
