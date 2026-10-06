import type { PurchaseInput } from "@/lib/counter";
import { isIsoDate } from "@/lib/requireStaff";

const VIA = ["drawer", "online", "own_pocket"];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Checks one purchase line; `partial` allows editing just some fields.
export function parsePurchase(raw: Record<string, unknown>, partial: boolean): { value?: Partial<PurchaseInput>; error?: string } {
  const out: Partial<PurchaseInput> = {};
  if (raw.purchaseDate !== undefined || !partial) {
    if (!isIsoDate(raw.purchaseDate)) return { error: "Pick a date." };
    out.purchaseDate = raw.purchaseDate;
  }
  if (raw.item !== undefined || !partial) {
    const item = typeof raw.item === "string" ? raw.item.trim() : "";
    if (!item) return { error: "Type what was bought." };
    out.item = item;
  }
  if (raw.brand !== undefined) out.brand = typeof raw.brand === "string" ? raw.brand : null;
  if (raw.unit !== undefined) out.unit = typeof raw.unit === "string" ? raw.unit : null;
  if (raw.note !== undefined) out.note = typeof raw.note === "string" ? raw.note : null;
  if (raw.paidBy !== undefined) out.paidBy = typeof raw.paidBy === "string" ? raw.paidBy : null;
  if (raw.quantity !== undefined) {
    const q = num(raw.quantity);
    if (q !== null && (Number.isNaN(q) || q < 0)) return { error: "Amount must be a number." };
    out.quantity = q;
  }
  if (raw.price !== undefined || !partial) {
    const p = num(raw.price);
    if (p === null || Number.isNaN(p) || p < 0) return { error: "Enter the price paid." };
    out.price = p;
  }
  if (raw.paidVia !== undefined || !partial) {
    if (!VIA.includes(String(raw.paidVia))) return { error: "Pick how it was paid." };
    out.paidVia = raw.paidVia as PurchaseInput["paidVia"];
  }
  if (out.paidVia === "own_pocket" && !partial && !(out.paidBy ?? "").trim()) {
    return { error: "Who paid from their own pocket?" };
  }
  if (raw.reimbursedOn !== undefined) {
    if (raw.reimbursedOn === null) {
      out.reimbursedOn = null;
      out.reimbursedVia = null;
    } else {
      if (!isIsoDate(raw.reimbursedOn)) return { error: "Pick the date they were paid back." };
      if (raw.reimbursedVia !== "drawer" && raw.reimbursedVia !== "online") return { error: "Paid back from the drawer or online?" };
      out.reimbursedOn = raw.reimbursedOn;
      out.reimbursedVia = raw.reimbursedVia;
    }
  }
  return { value: out };
}
