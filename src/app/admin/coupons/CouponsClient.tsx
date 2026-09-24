"use client";

import { useState } from "react";
import type { CouponBatch } from "@/lib/types";

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

// yyyy-mm-dd for a <input type="date">, from either a date-only string or a
// full sold_at timestamp -- used both for today's default and for showing
// an existing batch's date in the editable field.
function toDateInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

// Round 26: a small clickable pill for the paid/collected flags -- click to
// toggle, saves immediately (optimistic, reverts on failure) rather than
// needing a separate Save step, since these are simple on/off states.
function StatusPill({ on, onToggle, busy, labelOn, labelOff }: { on: boolean; onToggle: () => void; busy: boolean; labelOn: string; labelOff: string }) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      className={`inline-block rounded-full border px-2 py-0.5 text-xs disabled:opacity-50 ${
        on ? "border-green-200 bg-green-50 text-status-good" : "border-red-200 bg-red-50 text-status-out"
      }`}
    >
      {on ? labelOn : labelOff}
    </button>
  );
}

// Round 26: sold_at is often wrong when first entered -- a batch gets typed
// into the site days after the actual sale -- so each row lets the date be
// corrected directly, using the same edit-then-explicit-Save pattern as the
// rest of the admin screens (see UsedInRow on /admin/inventory), plus two
// independent Paid/Collected pills that save immediately since they're
// simple toggles rather than free text.
type BatchUpdates = { soldAt?: string; paid?: boolean; collected?: boolean; buyerName?: string; couponValue?: number; totalCollected?: number };

function BatchRow({ batch, onUpdate }: { batch: CouponBatch; onUpdate: (id: string, updates: BatchUpdates) => Promise<void> }) {
  const [soldAtInput, setSoldAtInput] = useState(() => toDateInputValue(batch.soldAt));
  const [savingDate, setSavingDate] = useState(false);
  const [busyPill, setBusyPill] = useState(false);
  const dirty = soldAtInput !== toDateInputValue(batch.soldAt);

  // Round 26 follow-up: buyer name / value each / total collected are only
  // ever set once, at creation -- "Edit" opens the same three fields inline
  // (a typo or a misheard amount is otherwise unfixable), saved together as
  // one PATCH rather than saved-as-you-type like the Paid/Collected pills.
  const [editing, setEditing] = useState(false);
  const [buyerNameInput, setBuyerNameInput] = useState(batch.buyerName);
  const [couponValueInput, setCouponValueInput] = useState(String(batch.couponValue));
  const [totalCollectedInput, setTotalCollectedInput] = useState(String(batch.totalCollected));
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveDate() {
    if (!soldAtInput) return;
    setSavingDate(true);
    try {
      await onUpdate(batch.id, { soldAt: soldAtInput });
    } finally {
      setSavingDate(false);
    }
  }

  async function togglePaid() {
    setBusyPill(true);
    try {
      await onUpdate(batch.id, { paid: !batch.paid });
    } finally {
      setBusyPill(false);
    }
  }

  async function toggleCollected() {
    setBusyPill(true);
    try {
      await onUpdate(batch.id, { collected: !batch.collected });
    } finally {
      setBusyPill(false);
    }
  }

  function startEdit() {
    setBuyerNameInput(batch.buyerName);
    setCouponValueInput(String(batch.couponValue));
    setTotalCollectedInput(String(batch.totalCollected));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    const value = Number(couponValueInput);
    const total = Number(totalCollectedInput);
    if (!buyerNameInput.trim() || !value || value <= 0 || Number.isNaN(total) || total < 0) return;
    setSavingEdit(true);
    try {
      await onUpdate(batch.id, { buyerName: buyerNameInput.trim(), couponValue: value, totalCollected: total });
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <tr className="border-t border-card-border">
      <td className="py-3 pr-3 font-medium text-navy-950">
        {editing ? (
          <input
            value={buyerNameInput}
            onChange={(e) => setBuyerNameInput(e.target.value)}
            className="w-32 rounded-md border border-card-border px-1.5 py-1 text-xs font-medium text-navy-950"
          />
        ) : (
          batch.buyerName
        )}
      </td>
      <td className="py-3 pr-3 text-sm text-navy-800">
        {editing ? (
          <input
            value={couponValueInput}
            onChange={(e) => setCouponValueInput(e.target.value)}
            type="number"
            className="w-20 rounded-md border border-card-border px-1.5 py-1 text-xs text-navy-950"
          />
        ) : (
          formatBaht(batch.couponValue)
        )}
      </td>
      <td className="py-3 pr-3 text-sm text-navy-800">
        {batch.redeemedCount} of {batch.quantity}
      </td>
      <td className="py-3 pr-3 text-sm text-navy-800">
        {editing ? (
          <input
            value={totalCollectedInput}
            onChange={(e) => setTotalCollectedInput(e.target.value)}
            type="number"
            className="w-24 rounded-md border border-card-border px-1.5 py-1 text-xs text-navy-950"
          />
        ) : (
          formatBaht(batch.totalCollected)
        )}
      </td>
      <td className="py-3 pr-3 text-sm text-navy-600">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={soldAtInput}
            onChange={(e) => setSoldAtInput(e.target.value)}
            className="w-[9.5rem] rounded-md border border-card-border px-1.5 py-1 text-xs text-navy-950"
          />
          {dirty && (
            <button onClick={saveDate} disabled={savingDate} className="shrink-0 text-xs font-medium text-status-good hover:underline">
              Save
            </button>
          )}
        </div>
      </td>
      <td className="py-3 pr-3">
        <StatusPill on={batch.paid} onToggle={togglePaid} busy={busyPill} labelOn="Paid" labelOff="Unpaid" />
      </td>
      <td className="py-3 pr-3">
        <StatusPill on={batch.collected} onToggle={toggleCollected} busy={busyPill} labelOn="Collected" labelOff="Not collected" />
      </td>
      <td className="py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={saveEdit} disabled={savingEdit} className="shrink-0 text-xs font-medium text-status-good hover:underline">
              Save
            </button>
            <button onClick={cancelEdit} disabled={savingEdit} className="shrink-0 text-xs text-navy-600 hover:underline">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="shrink-0 text-xs font-medium text-navy-800 hover:underline">
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}

export default function CouponsClient({ initialBatches }: { initialBatches: CouponBatch[] }) {
  const [batches, setBatches] = useState(initialBatches);
  const [buyerName, setBuyerName] = useState("");
  const [couponValue, setCouponValue] = useState("");
  const [codes, setCodes] = useState("");
  const [totalCollected, setTotalCollected] = useState("");
  const [soldAt, setSoldAt] = useState(() => toDateInputValue(new Date()));
  const [paid, setPaid] = useState(false);
  const [collected, setCollected] = useState(false);
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
        body: JSON.stringify({
          buyerName: buyerName.trim(),
          couponValue: value,
          codes: codeList,
          totalCollected: total,
          soldAt,
          paid,
          collected,
        }),
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
      setSoldAt(toDateInputValue(new Date()));
      setPaid(false);
      setCollected(false);
      const refreshed = await fetch("/api/coupons").then((r) => r.json());
      setBatches(refreshed.batches as CouponBatch[]);
    } finally {
      setCreating(false);
    }
  }

  // Round 26: shared by the inline date-edit Save and the Paid/Collected
  // pills -- optimistic update against local state, PATCH to persist,
  // revert to the previous batches list if the request fails.
  async function updateBatch(id: string, updates: BatchUpdates) {
    const previous = batches;
    setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    try {
      const res = await fetch(`/api/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        setBatches(previous);
        setError("Could not update this coupon batch.");
      }
    } catch {
      setBatches(previous);
      setError("Could not update this coupon batch.");
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
          <label className="flex flex-col gap-1 text-xs text-navy-600">
            Date sold
            <input
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
              type="date"
              className="rounded-md border border-card-border px-3 py-2 text-sm text-navy-950"
            />
          </label>
          <textarea
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder={"Coupon codes, one per line\n03\n04\n05\n..."}
            rows={4}
            className="rounded-md border border-card-border px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <p className="mt-2 text-xs text-navy-600">{codeCount} code{codeCount === 1 ? "" : "s"} entered.</p>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-xs text-navy-800">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid
          </label>
          <label className="flex items-center gap-1.5 text-xs text-navy-800">
            <input type="checkbox" checked={collected} onChange={(e) => setCollected(e.target.checked)} />
            Collected (physical coupons handed over)
          </label>
        </div>
        <p className="mt-1 text-xs text-navy-600">Leave unchecked if the sale still needs payment or pickup — you can mark either later from the table below.</p>
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
                <th className="pb-2">Paid</th>
                <th className="pb-2">Collected</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <BatchRow key={b.id} batch={b} onUpdate={updateBatch} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
