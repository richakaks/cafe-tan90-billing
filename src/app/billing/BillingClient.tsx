"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderRow } from "@/lib/types";
import SourceBadge, { TrialBadge } from "@/components/SourceBadge";

const POLL_MS = 8000;
const PICKUP_BUCKET = "Pickup (pre-order)";

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function orderTotals(order: OrderRow) {
  const gross = order.items.reduce((sum, it) => sum + it.qty * it.priceAtOrder, 0);
  const net = Math.max(0, gross - order.discountAmount);
  // Round 32: counter orders may be partly paid already (deposit / split);
  // the Cash / Online buttons then record only what's still owed.
  const due = Math.max(0, net - order.amountPaid);
  return { gross, net, due };
}

function CouponBox({ order, onApplied }: { order: OrderRow; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.couponCode) {
    return (
      <p className="mt-1 text-xs text-status-good">
        Coupon {order.couponCode} applied (&minus;{formatBaht(order.discountAmount)})
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 text-xs font-medium text-navy-700 underline decoration-dotted">
        Apply coupon
      </button>
    );
  }

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not apply that coupon.");
        return;
      }
      setOpen(false);
      onApplied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Coupon code"
        className="w-24 rounded-md border border-card-border px-2 py-1 text-xs"
      />
      <button disabled={busy} onClick={apply} className="rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50">
        Apply
      </button>
      {error && <span className="text-xs text-status-out">{error}</span>}
    </div>
  );
}

type PaymentMethod = "cash" | "online";

// Two side-by-side buttons rather than one "mark paid" button plus a
// separate method picker — payment method is required at the moment of
// marking paid (Round 17), so the choice itself is the action.
function PayButtons({ busy, filled, onPick }: { busy: boolean; filled?: boolean; onPick: (method: PaymentMethod) => void }) {
  const base = filled
    ? "flex-1 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
    : "flex-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-100 disabled:opacity-50";
  return (
    <div className="mt-2 flex gap-2">
      <button onClick={() => onPick("cash")} disabled={busy} className={base}>
        {busy ? "…" : "💵 Cash"}
      </button>
      <button onClick={() => onPick("online")} disabled={busy} className={base}>
        {busy ? "…" : "💳 Online"}
      </button>
    </div>
  );
}

export default function BillingClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [payError, setPayError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/orders/served", { cache: "no-store" });
      if (res.ok) setOrders((await res.json()).orders as OrderRow[]);
    } catch {
      // silent — next poll will retry
    }
  }

  useEffect(() => {
    timer.current = setInterval(refresh, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const bySeat = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const order of orders) {
      const key = order.isTrial ? "Trial orders (practice — not counted)" : order.seatId ?? (order.source === "counter" ? (order.customerLabel ? `Counter · ${order.customerLabel}` : "Counter") : PICKUP_BUCKET);
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  async function pay(orderIds: string[], paymentMethod: PaymentMethod) {
    setPayingIds((prev) => new Set([...prev, ...orderIds]));
    setPayError(null);
    try {
      const res = await fetch("/api/orders/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, paymentMethod }),
      });
      const body = await res.json();
      if (!res.ok) {
        setPayError(body.error ?? "Could not mark this bill paid.");
        return;
      }
      setOrders((prev) => prev.filter((o) => !orderIds.includes(o.id)));
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        for (const id of orderIds) next.delete(id);
        return next;
      });
    }
  }

  if (orders.length === 0) {
    return <p className="card p-6 text-sm text-navy-600">Nothing waiting on a bill right now.</p>;
  }

  return (
    <div className="space-y-6">
      {payError && <p className="text-sm text-status-out">{payError}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {bySeat.map(([seatKey, seatOrders]) => {
          const combinedGross = seatOrders.reduce((sum, o) => sum + orderTotals(o).gross, 0);
          const combinedNet = seatOrders.reduce((sum, o) => sum + orderTotals(o).due, 0);
          const allIds = seatOrders.map((o) => o.id);
          const anyBusy = allIds.some((id) => payingIds.has(id));

          return (
            <div key={seatKey} className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-600">{seatKey}</h3>
                {seatOrders.length > 1 && <span className="text-xs text-navy-600">{seatOrders.length} orders</span>}
              </div>

              <div className="mt-3 space-y-4">
                {seatOrders.map((order) => {
                  const { gross, net, due } = orderTotals(order);
                  return (
                    <div key={order.id} className="border-t border-card-border pt-3 first:border-t-0 first:pt-0">
                      <p className="flex items-center gap-1.5 font-semibold text-navy-950">
                        {order.isTrial ? "Trial" : "Order"} #{order.dailyOrderNumber ?? "—"} <SourceBadge source={order.source} />
                        {order.isTrial && <TrialBadge />}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-sm text-navy-800">
                        {order.items.map((it) => (
                          <li key={it.id}>
                            {it.qty}&times; {it.itemName}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-1 text-xs text-navy-600">
                        {order.discountAmount > 0 ? (
                          <>
                            <span className="line-through">{formatBaht(gross)}</span> {formatBaht(net)}
                          </>
                        ) : (
                          formatBaht(gross)
                        )}
                      </div>
                      {order.amountPaid !== 0 && (
                        <p className="text-xs text-navy-700">
                          Already paid {formatBaht(order.amountPaid)} &middot; <span className="font-semibold">still owed {formatBaht(due)}</span>
                        </p>
                      )}
                      <CouponBox order={order} onApplied={refresh} />
                      <p className="mt-2 text-xs text-navy-600">Mark paid — how?</p>
                      <PayButtons busy={payingIds.has(order.id)} onPick={(method) => pay([order.id], method)} />
                    </div>
                  );
                })}
              </div>

              {seatOrders.length > 1 && (
                <div className="mt-4 border-t border-card-border pt-4">
                  <div className="flex justify-between text-sm font-semibold text-navy-950">
                    <span>Combined total</span>
                    <span>
                      {combinedGross !== combinedNet ? (
                        <>
                          <span className="mr-1 font-normal text-navy-600 line-through">{formatBaht(combinedGross)}</span>
                          {formatBaht(combinedNet)}
                        </>
                      ) : (
                        formatBaht(combinedNet)
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-navy-600">Bill together — mark all paid, how?</p>
                  <PayButtons busy={anyBusy} filled onPick={(method) => pay(allIds, method)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
