"use client";

import { useState } from "react";
import type { CouponBatch } from "@/lib/types";

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default function CouponsClient({ initialBatches }: { initialBatches: CouponBatch[] }) {
  const [batches, setBatches] = useState(initialBatches);
  const [buyerName, setBuyerName] = useState("");
  const [couponValue, setCouponValue] = useState("");
  const [codes, setCodes] = useState("");
  const [totalCollected, setTotalCollected] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeCount = codes
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean).length;

  function suggestedTotal() {
    const v = Number(couponValue);
    if (!v || codeCount === 0) return "";
    return String(v * codeCount);
  }

  async function save() {
    const value = Number(couponValue);
    const codeList = codes.split(/[\n,]/).map((c) => c.trim()).filter(Boolean);
    const total = totalCollected.trim() ? Number(totalCollected) : value * codeList.length;

    if (!buyerName.trim() || !value || codeList.length === 0) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerName: buyerName.trim(), couponValue: value, codes: codeList, totalCollected: total }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not save this coupon batch.");
        return;
      }
      setBuyerName("");
      setCouponValue("");
      setCodes("");
      setTotalCollected("");
      const refreshed = await fetch("/api/coupons").then((r) => r.json());
      setBatches(refreshed.batches as CouponBatch[]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Record a coupon batch sale</h2>
        <p className="mt-1 text-xs text-navy-600">
          Enter the codes already printed on the physical coupons you&rsquo;re handing out — one per line (or comma-separated).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Buyer (person / org / event name)"
            className="rounded-md border border-card-border px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            value={couponValue}
            onChange={(e) => setCouponValue(e.target.value)}
            type="number"
            placeholder="Value per coupon (฿)"
            className="rounded-md border border-card-border px-3 py-2 text-sm"
          />
          <input
            value={totalCollected}
            onChange={(e) => setTotalCollected(e.target.value)}
            type="number"
            placeholder={`Total collected (defaults to ${suggestedTotal() || "value × count"})`}
            className="rounded-md border border-card-border px-3 py-2 text-sm"
          />
          <textarea
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder={"Coupon codes, one per line\n03\n04\n05\n..."}
            rows={4}
            className="rounded-md border border-card-border px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <p className="mt-2 text-xs text-navy-600">{codeCount} code{codeCount === 1 ? "" : "s"} entered.</p>
        {error && <p className="mt-2 text-sm text-status-out">{error}</p>}
        <button
          onClick={save}
          disabled={creating}
          className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {creating ? "Saving…" : "Save batch"}
        </button>
      </div>

      <div className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">All coupon batches</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-navy-600">No coupon batches recorded yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-navy-600">
                <th className="pb-2">Buyer</th>
                <th className="pb-2">Value each</th>
                <th className="pb-2">Redeemed</th>
                <th className="pb-2">Total collected</th>
                <th className="pb-2">Sold</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-card-border">
                  <td className="py-3 pr-3 font-medium text-navy-950">{b.buyerName}</td>
                  <td className="py-3 pr-3 text-sm text-navy-800">{formatBaht(b.couponValue)}</td>
                  <td className="py-3 pr-3 text-sm text-navy-800">
                    {b.redeemedCount} of {b.quantity}
                  </td>
                  <td className="py-3 pr-3 text-sm text-navy-800">{formatBaht(b.totalCollected)}</td>
                  <td className="py-3 text-sm text-navy-600">{new Date(b.soldAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
