"use client";

// Shared destructive-action controls for orders, used from both
// /admin/inventory's Danger Zone (alongside the stock-only reset tools) and
// /admin/analytics' Danger Zone (since these two actions are what clear test
// sales data — analytics has no separate "sales" record of its own, it's
// computed live from the orders table). Kept in one place so the two pages
// can never drift out of sync on what "reset orders" actually does.

import { useState } from "react";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export function ResetButton({
  label,
  confirmLabel,
  warning,
  endpoint,
}: {
  label: string;
  confirmLabel: string;
  warning: string;
  endpoint: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Something went wrong.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-status-out px-4 py-2 text-sm font-medium text-status-out hover:bg-red-50"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-status-out bg-red-50 p-3">
      <p className="text-sm text-status-out">{warning}</p>
      {error && <p className="mt-1 text-sm text-status-out">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-status-out px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Same "delete orders, un-redeem their coupons, leave stock alone" action as
// "Reset all orders," but scoped to a date range (order_date, inclusive) so
// only-just-tested orders can be cleared without wiping any real sales that
// might already be mixed in. Split into pick-dates -> confirm-exact-dates so
// the final confirmation always shows precisely what's about to be deleted.
export function RangeResetOrdersButton() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-orders-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Something went wrong.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-status-out px-4 py-2 text-sm font-medium text-status-out hover:bg-red-50"
      >
        Reset orders in a date range
      </button>
    );
  }

  const validRange = Boolean(from) && Boolean(to) && from <= to;

  return (
    <div className="rounded-lg border border-status-out bg-red-50 p-3">
      <p className="text-sm text-status-out">
        Deletes every order (any status) with an order date in this range, and frees up any coupon codes they&apos;d
        redeemed — same as &quot;Reset all orders&quot; but scoped to these dates. It does not touch ingredient stock
        levels. A pre-order still awaiting pickup has no order date yet and is never included.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-navy-800">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setConfirming(false);
            }}
            className="rounded-md border border-card-border px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-navy-800">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setConfirming(false);
            }}
            className="rounded-md border border-card-border px-2 py-1 text-sm"
          />
        </label>
      </div>
      {!validRange && <p className="mt-1 text-xs text-status-out">&quot;From&quot; must be on or before &quot;To&quot;.</p>}
      {error && <p className="mt-1 text-sm text-status-out">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!validRange}
            className="rounded-md bg-status-out px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={run}
            disabled={busy || !validRange}
            className="rounded-md bg-status-out px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Working…" : `Yes, delete orders from ${from} to ${to}`}
          </button>
        )}
        <button
          onClick={() => {
            if (confirming) {
              setConfirming(false);
            } else {
              setOpen(false);
              setError(null);
            }
          }}
          disabled={busy}
          className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100"
        >
          {confirming ? "Back" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
