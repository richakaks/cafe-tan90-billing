"use client";

import { useState } from "react";
import { baht, couponLeft, postJson } from "./api";

// Round 35: add a coupon to a bill. A coupon covers the bill up to what's
// left on it; anything left stays on the code for next time. Staff can use
// less on purpose, or record just the amount when the code isn't to hand.
export default function CouponPanel({
  orderId,
  staffId,
  isTrial,
  onDone,
}: {
  orderId: string;
  staffId: string | null;
  isTrial: boolean;
  onDone: (message: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [useLess, setUseLess] = useState(false);
  const [useAmount, setUseAmount] = useState("");
  const [pending, setPending] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyCode() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    const amount = useLess && Number(useAmount) > 0 ? Number(useAmount) : undefined;
    const { error: err, data } = await postJson(`/api/counter/orders/${orderId}/coupons`, { code: c, amount, staffId });
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    const used = Number(data?.used ?? 0);
    const left = await couponLeft(c);
    setBusy(false);
    onDone(
      `Coupon ${c}: ${baht(used)} taken off the bill` +
        (left === null ? "." : left > 0.005 ? ` · ${baht(left)} still left on it for next time.` : " · coupon is now used up.")
    );
  }

  async function addPending() {
    const amt = Number(pending);
    if (!(amt > 0)) return;
    setBusy(true);
    setError(null);
    const { error: err, data } = await postJson(`/api/counter/orders/${orderId}/coupons`, { pendingAmount: amt, staffId });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onDone(`${baht(Number(data?.used ?? amt))} coupon recorded as "code pending" — add the code when you have it.`);
  }

  return (
    <div className="space-y-2 rounded-lg bg-navy-100/60 p-3 text-sm">
      {isTrial ? (
        <p className="text-[11px] text-navy-600">Trial order: real coupon codes can&rsquo;t be used (they&rsquo;d be used up). Use &ldquo;code pending&rdquo; below to practise.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCode();
              }}
              placeholder="Coupon code"
              className="min-w-0 flex-1 rounded-md border border-card-border bg-white px-2 py-1.5"
            />
            <button
              type="button"
              disabled={busy || !code.trim()}
              onClick={applyCode}
              className="rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-navy-700">
            <input type="checkbox" checked={useLess} onChange={(e) => setUseLess(e.target.checked)} />
            Use only part of it (customer keeps the rest for later)
          </label>
          {useLess && (
            <input
              inputMode="decimal"
              value={useAmount}
              onChange={(e) => setUseAmount(e.target.value)}
              placeholder="Use ฿"
              className="w-28 rounded-md border border-card-border bg-white px-2 py-1.5"
            />
          )}
          <p className="text-[11px] text-navy-600">The coupon covers the bill up to what&rsquo;s left on it. Anything left stays on the same code.</p>
        </>
      )}
      <div className="border-t border-card-border pt-2">
        <p className="text-[11px] text-navy-600">No code to hand? Record the amount taken off now and type the code in later:</p>
        <div className="mt-1 flex gap-2">
          <input
            inputMode="decimal"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            placeholder="Amount off ฿"
            className="w-32 rounded-md border border-card-border bg-white px-2 py-1.5"
          />
          <button
            type="button"
            disabled={busy || !(Number(pending) > 0)}
            onClick={addPending}
            className="rounded-md border border-card-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy-900 disabled:opacity-40"
          >
            Add as &ldquo;code pending&rdquo;
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-status-out">{error}</p>}
    </div>
  );
}
