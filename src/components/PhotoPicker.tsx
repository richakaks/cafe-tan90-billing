"use client";

import { useEffect, useState } from "react";
import { compressImage } from "@/app/purchases/inventoryLink";

// Round 42: pick a photo before the thing it belongs to exists (e.g. a new
// ingredient). Holds a compressed JPEG + preview; the caller uploads it after
// creating the record (see uploadIngredientPhoto).
export default function PhotoPicker({ value, onChange, label = "Photo (optional)" }: { value: Blob | null; onChange: (b: Blob | null) => void; label?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the preview when the photo is removed
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  return (
    <div className="flex items-center gap-2 text-xs text-navy-700">
      <span>{label}</span>
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={preview} alt="" className="h-12 w-12 rounded-md object-cover" />
          <button type="button" onClick={() => onChange(null)} className="text-status-out underline">
            remove
          </button>
        </>
      ) : (
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onChange(await compressImage(f));
          }}
          className="text-xs"
        />
      )}
    </div>
  );
}

export async function uploadIngredientPhoto(id: string, photo: Blob): Promise<string | null> {
  const fd = new FormData();
  fd.append("image", photo, "photo.jpg");
  try {
    const res = await fetch(`/api/inventory/${id}/image`, { method: "POST", body: fd });
    if (res.ok) return null;
    return (await res.json().catch(() => ({}))).error ?? "Could not upload the photo.";
  } catch {
    return "No connection — photo not uploaded.";
  }
}

// Small thumbnail that opens the full photo.
export function IngredientThumb({ url, size = "h-10 w-10" }: { url: string | null | undefined; size?: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0" title="Open photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- stored public photo */}
      <img src={url} alt="" className={`${size} rounded-md border border-card-border object-cover`} />
    </a>
  );
}
