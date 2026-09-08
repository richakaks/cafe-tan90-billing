import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { updateMenuItemImage } from "@/lib/data";

// Round 21: menu item photo upload. The client crops/resizes the image
// client-side (see ImageCropUpload.tsx) and posts the final JPEG blob here
// as multipart/form-data -- this route just stores it and points
// menu_items.image_url at it, it doesn't do any image processing itself.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB, generous for an already-cropped/compressed photo
const BUCKET = "menu-images";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart/form-data upload." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file found in the upload." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That image looks empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 5MB)." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "That doesn't look like an image file." }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    // Stable path per item code (upsert: true) so re-uploading a photo
    // replaces it in place instead of leaving old versions orphaned in the
    // bucket -- a `?t=` cache-busting suffix is appended to the stored URL
    // below so the browser always fetches the new bytes after a replace.
    const path = `${code}.jpg`;
    const { error: uploadErr } = await db()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: pub } = db().storage.from(BUCKET).getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    await updateMenuItemImage(code, url);
    return NextResponse.json({ ok: true, imageUrl: url });
  } catch (err) {
    console.error("menu image upload failed", err);
    return NextResponse.json({ error: "Could not upload this image." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    await db().storage.from(BUCKET).remove([`${code}.jpg`]);
    await updateMenuItemImage(code, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("menu image delete failed", err);
    return NextResponse.json({ error: "Could not remove this image." }, { status: 500 });
  }
}
