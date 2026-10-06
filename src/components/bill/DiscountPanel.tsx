"use client";

import { useState } from "react";
import { baht, postJson } from "./api";

// Round 35: % or fixed-amount discount on any bill, with a reason.
export default function DiscountPanel({
  orderId,
  staffId,
  gross,
  currentPct,
  currentAmount,
  currentNote,
  onDone,
}: {
  orderId: string;
  staffId: string | null;
  gross: number;
  currentPct: number | null;
  currentAmount: number;
  currentNote: string | null;
  onDone: (message: string | null) => void;
}) {
  const hasDiscount = (currentPct ?? 0) > 0 || currentAmount > 0;
  const [mode, setMode] = useState<"pct" | "amount">(currentPct ? "pct" : currentAmount > 0 ? "amount" : "pct");
  const [value, setValue] = useState(currentPct ? String(currentPct) : currentAmount > 0 ? String(currentAmount) : "");
  const [note, setNote] = useState(currentNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = Number(value) || 0;
  const preview = mode === "pct" ? Math.round(gross * Math.min(100, Math.max(0, num))) / 100 : num;

  async function save(clear: boolean) {
    setBusy(true);
    setError(null);
    const body = clear
      ? { pct: null, amount: null, note: "", staffId }
      : { pct: mode === "pct" ? num : null, amount: mode === "amount" ? num : null, note, staffId };
    const { error: err } = await postJson(`/api/counter/orders/${orderId}/discount`, body);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onDone(clear ? "Discount removed." : `Discount of ${baht(preview)} saved.`);
  }

  return (
    <div className="space-y-2 rounded-lg bg-navy-100/60 p-3 text-sm">
      <div className="flex gap-2">
        {(["pct", "amount"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-navy-900 text-white" : "border border-card-border bg-white text-navy-900"}`}
          >
            {m === "pct" ? "% off" : "฿ off"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "pct" ? "%" : "฿"}
          className="w-24 rounded-md border border-card-border bg-white px-2 py-1.5"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (required)"
          className="min-w-0 flex-1 rounded-md border border-card-border bg-white px-2 py-1.5"
        />
      </div>
      {num > 0 && <p className="text-[11px] text-navy-600">Takes {baht(preview)} off the {baht(gross)} items.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !(num > 0) || !note.trim()}
          onClick={() => save(false)}
          className="flex-1 rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save discount
        </button>
        {hasDiscount && (
          <button type="button" disabled={busy} onClick={() => save(true)} className="rounded-md border border-card-border bg-white px-3 py-2 text-xs font-medium text-status-out">
            Remove discount
          </button>
        )}
      </div>
      {error && <p className="text-xs text-status-out">{error}</p>}
    </div>
  );
}
