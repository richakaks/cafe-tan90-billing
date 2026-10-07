"use client";

import { useState } from "react";
import { postJson } from "./api";

// Cancel a bill with a reason (counter cards + Billing).
export default function VoidPanel({ orderId, staffId, onDone }: { orderId: string; staffId: string | null; onDone: (message: string | null) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doVoid() {
    setBusy(true);
    setError(null);
    const { error: err } = await postJson(`/api/counter/orders/${orderId}/void`, { reason, staffId });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onDone("Order voided.");
  }

  return (
    <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm">
      <p className="text-xs text-navy-800">
        Voiding cancels the order: it stops counting in sales, money on its coupons goes back on the coupons, and its payments no longer count in the drawer. It
        stays in the history. Any stock it took off is put back.
      </p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="w-full rounded-md border border-card-border bg-white px-2 py-1.5" />
      <button
        type="button"
        disabled={busy || !reason.trim()}
        onClick={doVoid}
        className="w-full rounded-md bg-status-out px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Void this order
      </button>
      {error && <p className="text-xs text-status-out">{error}</p>}
    </div>
  );
}
