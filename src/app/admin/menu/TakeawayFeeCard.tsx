"use client";

import { useState } from "react";

// Round 42: owner setting for the takeaway charge per takeaway item.
export default function TakeawayFeeCard({ initialAmount }: { initialAmount: number }) {
  const [saved, setSaved] = useState(initialAmount);
  const [value, setValue] = useState(String(initialAmount));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = Number(value) !== saved;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/takeaway-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(value) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(Number(data.amount));
      setMsg(Number(data.amount) > 0 ? "Saved — new orders use this amount." : "Saved — takeaway charge is off.");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-2 p-5">
      <h2 className="text-sm font-semibold text-navy-950">Takeaway charge</h2>
      <p className="text-xs text-navy-600">
        Added to the bill for every item marked takeaway (per item, e.g. 3 takeaway items × ฿{saved} = ฿{saved * 3}), on QR, pre-order and counter orders.
        It shows as its own &ldquo;Takeaway charge&rdquo; line. Orders already placed keep the amount they were sold at. Set 0 to turn it off.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-navy-800">฿ per takeaway item</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-md border border-card-border px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={busy || !dirty || !(Number(value) >= 0)}
          onClick={save}
          className="rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {msg && <p className="text-xs text-navy-700">{msg}</p>}
    </div>
  );
}
