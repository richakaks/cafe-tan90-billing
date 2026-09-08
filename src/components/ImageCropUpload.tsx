"use client";

import { useEffect, useRef, useState } from "react";

// Round 21: a small, dependency-free image crop/upload widget for a menu
// item's photo. No new package (same "no new dependency" convention as the
// admin Menu page's own drag-and-drop reorder) -- just a square canvas
// viewport the user pans and zooms an image within (cover-fit, Instagram-
// style), then "Save photo" rasterizes exactly what's visible onto a fixed
// output size and uploads it.
//
// VIEWPORT is the on-screen crop square in CSS pixels; OUTPUT is the
// resolution the final cropped JPEG is rasterized at, independent of
// viewport size or the source photo's own resolution.
const VIEWPORT = 260;
const OUTPUT = 640;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = src;
  });
}

export default function ImageCropUpload({
  code,
  currentImageUrl,
  onSaved,
}: {
  code: string;
  currentImageUrl: string | null;
  onSaved: (imageUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [pickedImage, setPickedImage] = useState<HTMLImageElement | null>(null);
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // top-left of the drawn image, in viewport px
  const [dragging, setDragging] = useState<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clampOffset(next: { x: number; y: number }, s: number, img: HTMLImageElement) {
    const w = img.width * s;
    const h = img.height * s;
    return {
      x: Math.min(0, Math.max(VIEWPORT - w, next.x)),
      y: Math.min(0, Math.max(VIEWPORT - h, next.y)),
    };
  }

  async function onPickFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      const cover = Math.max(VIEWPORT / img.width, VIEWPORT / img.height);
      imgRef.current = img;
      setPickedImage(img);
      setMinScale(cover);
      setScale(cover);
      setOffset(clampOffset({ x: (VIEWPORT - img.width * cover) / 2, y: (VIEWPORT - img.height * cover) / 2 }, cover, img));
    } catch {
      setError("Could not read that image file.");
    }
  }

  // Redraw the crop viewport whenever the picked image, scale, or offset changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !pickedImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEWPORT, VIEWPORT);
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
  }, [pickedImage, scale, offset]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pickedImage) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging({ startX: e.clientX, startY: e.clientY, startOffset: offset });
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging || !imgRef.current) return;
    const next = {
      x: dragging.startOffset.x + (e.clientX - dragging.startX),
      y: dragging.startOffset.y + (e.clientY - dragging.startY),
    };
    setOffset(clampOffset(next, scale, imgRef.current));
  }
  function onPointerUp() {
    setDragging(null);
  }

  function onZoom(next: number) {
    if (!imgRef.current) return;
    setScale(next);
    setOffset((prev) => clampOffset(prev, next, imgRef.current!));
  }

  async function save() {
    if (!canvasRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const out = document.createElement("canvas");
      out.width = OUTPUT;
      out.height = OUTPUT;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported.");
      // The viewport canvas already shows exactly the cropped view at
      // VIEWPORT resolution -- just scale that same view up/down to OUTPUT.
      ctx.drawImage(canvasRef.current, 0, 0, VIEWPORT, VIEWPORT, 0, 0, OUTPUT, OUTPUT);
      const blob: Blob | null = await new Promise((resolve) => out.toBlob(resolve, "image/jpeg", 0.88));
      if (!blob) throw new Error("Could not export the cropped image.");

      const formData = new FormData();
      formData.append("image", blob, `${code}.jpg`);
      const res = await fetch(`/api/menu/${code}/image`, { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not upload this image.");
        return;
      }
      setPickedImage(null);
      onSaved(body.imageUrl as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this image.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/menu/${code}/image`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not remove this photo.");
        return;
      }
      onSaved(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Photo</p>

      {!pickedImage ? (
        <div className="mt-2 flex items-center gap-3">
          {currentImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImageUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-card-border text-[10px] text-navy-500">
              No photo
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100"
            >
              {currentImageUrl ? "Change photo" : "Add photo"}
            </button>
            {currentImageUrl && (
              <button disabled={busy} onClick={removePhoto} className="text-xs font-medium text-status-out hover:underline disabled:opacity-50">
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="mt-2 max-w-[300px]">
          <p className="text-xs text-navy-600">Drag to reposition, use the slider to zoom. This crop is what customers will see.</p>
          <canvas
            ref={canvasRef}
            width={VIEWPORT}
            height={VIEWPORT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="mt-2 cursor-move touch-none rounded-md border border-card-border"
          />
          <input
            type="range"
            min={minScale}
            max={minScale * 3}
            step={minScale / 100}
            value={scale}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-2 flex gap-1.5">
            <button
              disabled={busy}
              onClick={save}
              className="rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save photo"}
            </button>
            <button
              disabled={busy}
              onClick={() => setPickedImage(null)}
              className="rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-status-out">{error}</p>}
    </div>
  );
}
