"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderRow } from "@/lib/types";
import SourceBadge, { TrialBadge } from "@/components/SourceBadge";

const POLL_MS = 6000;
const PICKUP_BUCKET = "Pickup (pre-order)";
const COUNTER_BUCKET = "Counter";
const TRIAL_BUCKET = "Trial orders (practice — not counted)";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

export default function ServeClient({ initialOrders, initialPreOrders }: { initialOrders: OrderRow[]; initialPreOrders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [preOrders, setPreOrders] = useState(initialPreOrders);
  const [servingId, setServingId] = useState<string | null>(null);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fulfillError, setFulfillError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const [ordersRes, preOrdersRes] = await Promise.all([
        fetch("/api/orders/open", { cache: "no-store" }),
        fetch("/api/orders/pending", { cache: "no-store" }),
      ]);
      if (ordersRes.ok) setOrders((await ordersRes.json()).orders as OrderRow[]);
      if (preOrdersRes.ok) setPreOrders((await preOrdersRes.json()).orders as OrderRow[]);
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
      // Round 32: counter orders have no seat -- grouped under "Counter".
      const key = order.isTrial
        ? TRIAL_BUCKET
        : order.seatId ?? (order.source === "counter" && order.orderType === "counter" ? COUNTER_BUCKET : PICKUP_BUCKET);
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  const preOrdersByDate = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const order of preOrders) {
      const key = order.requestedDate ?? "unknown";
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [preOrders]);

  // Round 33: practice orders for trying out the serving screen.
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialMsg, setTrialMsg] = useState<string | null>(null);
  async function addTrial() {
    setTrialBusy(true);
    setTrialMsg(null);
    try {
      const res = await fetch("/api/counter/trial", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await res.json().catch(() => ({}));
      setTrialMsg(res.ok ? "Trial order added below — try marking it served, then pay it on Billing. It's never counted." : body.error ?? "Could not add a trial order.");
      refresh();
    } finally {
      setTrialBusy(false);
    }
  }
  async function clearTrials() {
    if (!window.confirm("Delete all trial orders?")) return;
    await fetch("/api/counter/trial", { method: "DELETE" }).catch(() => null);
    setTrialMsg("Trial orders cleared.");
    refresh();
  }
  const hasTrials = orders.some((o) => o.isTrial);

  async function markServed(id: string) {
    setServingId(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await fetch(`/api/orders/${id}/serve`, { method: "POST" });
    } finally {
      setServingId(null);
      refresh();
    }
  }

  async function fulfill(id: string) {
    setFulfillingId(id);
    setFulfillError(null);
    try {
      const res = await fetch(`/api/orders/${id}/fulfill`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setFulfillError(body.error ?? "Could not fulfill this pre-order.");
        return;
      }
      setPreOrders((prev) => prev.filter((o) => o.id !== id));
      refresh();
    } finally {
      setFulfillingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-orange-300 px-4 py-3">
        <span className="text-sm text-navy-700">Practise the serving screen with an order that is never recorded.</span>
        <span className="flex gap-2">
          {hasTrials && (
            <button type="button" onClick={clearTrials} className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700">
              Clear trial orders
            </button>
          )}
          <button type="button" disabled={trialBusy} onClick={addTrial} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {trialBusy ? "Adding…" : "Trial order"}
          </button>
        </span>
        {trialMsg && <p className="w-full text-xs text-orange-700">{trialMsg}</p>}
      </div>
      {preOrders.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-600">Upcoming pre-orders</h2>
          {fulfillError && <p className="mb-2 text-sm text-status-out">{fulfillError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {preOrdersByDate.map(([date, dateOrders]) => (
              <div key={date} className="card p-5">
                <h3 className="text-sm font-semibold text-navy-950">
                  {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </h3>
                <div className="mt-3 space-y-4">
                  {dateOrders.map((order) => (
                    <div key={order.id} className="border-t border-card-border pt-3 first:border-t-0 first:pt-0">
                      <p className="flex items-center gap-1.5 text-xs text-navy-600">
                        <SourceBadge source={order.source} />
                        {order.requestedTime ? `Around ${order.requestedTime.slice(0, 5)}` : "Any time"}
                        {order.customerLabel ? ` · ${order.customerLabel}` : ""}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-sm text-navy-800">
                        {order.items.map((it) => (
                          <li key={it.id}>
                            {it.qty}&times; {it.itemName}
                            {it.note && <span className="ml-1 text-xs italic text-navy-600">&ldquo;{it.note}&rdquo;</span>}
                            {it.fulfillmentType === "takeaway" && (
                              <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-status-low">
                                Takeaway
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => fulfill(order.id)}
                        disabled={fulfillingId === order.id}
                        className="mt-2 w-full rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-100 disabled:opacity-50"
                      >
                        {fulfillingId === order.id ? "Fulfilling…" : "Fulfill now"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-600">Open orders</h2>
        {orders.length === 0 ? (
          <p className="card p-6 text-sm text-navy-600">No open orders right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {bySeat.map(([seatKey, seatOrders]) => (
              <div key={seatKey} className="card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-600">{seatKey}</h3>
                <div className="mt-3 space-y-4">
                  {seatOrders.map((order) => (
                    <div key={order.id} className="border-t border-card-border pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 font-semibold text-navy-950">
                          {order.isTrial ? "Trial" : "Order"} #{order.dailyOrderNumber}
                          <SourceBadge source={order.source} />
                          {order.isTrial && <TrialBadge />}
                          {order.customerLabel && <span className="text-xs font-normal text-navy-700">{order.customerLabel}</span>}
                        </p>
                        <p className="text-xs text-navy-600">{timeAgo(order.createdAt)}</p>
                      </div>
                      <ul className="mt-1 space-y-0.5 text-sm text-navy-800">
                        {order.items.map((it) => (
                          <li key={it.id}>
                            {it.qty}&times; {it.itemName}
                            {it.note && <span className="ml-1 text-xs italic text-navy-600">&ldquo;{it.note}&rdquo;</span>}
                            {it.fulfillmentType === "takeaway" && (
                              <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-status-low">
                                Takeaway
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => markServed(order.id)}
                        disabled={servingId === order.id}
                        className="mt-2 w-full rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
                      >
                        Mark served
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
