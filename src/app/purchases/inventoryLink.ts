// Round 34: helpers for turning a purchase line ("3 kg Onion") into an
// amount in the linked inventory item's own unit ("3000 g").

const ALIASES: Record<string, string> = {
  g: "g",
  gm: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  l: "l",
  lt: "l",
  ltr: "l",
  litre: "l",
  liter: "l",
  litres: "l",
  liters: "l",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
};

export function normUnit(unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase();
  return ALIASES[u] ?? u;
}

// Known conversions that never need asking. Returns null when unknown.
export function autoFactor(fromUnit: string | null | undefined, toUnit: string | null | undefined): number | null {
  const a = normUnit(fromUnit);
  const b = normUnit(toUnit);
  if (!a || !b) return null;
  if (a === b) return 1;
  if (a === "kg" && b === "g") return 1000;
  if (a === "g" && b === "kg") return 0.001;
  if (a === "l" && b === "ml") return 1000;
  if (a === "ml" && b === "l") return 0.001;
  return null;
}

// Default unit for a brand-new inventory item made from a purchase line:
// weights in grams and volumes in ml (like the rest of the inventory).
export function baseUnitFor(purchaseUnit: string | null | undefined): string {
  const u = normUnit(purchaseUnit);
  if (u === "kg" || u === "g") return "g";
  if (u === "l" || u === "ml") return "ml";
  if (u === "pcs") return "pcs";
  return (purchaseUnit ?? "").trim() || "pcs";
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Shrinks a photo to a JPEG (longest side 1600px) before upload so receipts
// stay small and upload fast on mobile data.
export async function compressImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82));
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
