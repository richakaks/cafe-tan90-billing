import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireStaff } from "@/lib/requireStaff";

// Round 42: ingredient photo (what to buy / what it looks like). Stored in
// the existing public "menu-images" bucket under ingredients/<id>.jpg; the
// client crops/compresses it first.
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "menu-images";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart/form-data upload." }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No image file found in the upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large (max 5MB)." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "That doesn't look like an image file." }, { status: 400 });
  try {
    const path = `ingredients/${id}.jpg`;
    const { error: upErr } = await db().storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = db().storage.from(BUCKET).getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await db().from("ingredients").update({ image_url: url }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, imageUrl: url });
  } catch (err) {
    console.error("ingredient image upload failed", err);
    return NextResponse.json({ error: "Could not upload this image." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await db().storage.from(BUCKET).remove([`ingredients/${id}.jpg`]);
    const { error } = await db().from("ingredients").update({ image_url: null }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ingredient image delete failed", err);
    return NextResponse.json({ error: "Could not remove this photo." }, { status: 500 });
  }
}
