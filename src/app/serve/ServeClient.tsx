"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderRow } from "@/lib/types";

const POLL_MS = 6000;

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

export default function ServeClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [servingId, setServingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/orders/open", { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      setOrders(body.orders as OrderRow[]);
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
      const list = map.get(order.seatId) ?? [];
      list.push(order);
      map.set(order.seatId, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

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

  if (orders.length === 0) {
    return <p className="card p-6 text-sm text-navy-600">No open orders right now.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {bySeat.map(([seatId, seatOrders]) => (
        <div key={seatId} className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-600">{seatId}</h2>
          <div className="mt-3 space-y-4">
            {seatOrders.map((order) => {
              const total = order.items.reduce((sum, it) => sum + it.qty * it.priceAtOrder, 0);
              return (
                <div key={order.id} className="border-t border-card-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-navy-950">Order #{order.dailyOrderNumber}</p>
                    <p className="text-xs text-navy-600">{timeAgo(order.createdAt)}</p>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-sm text-navy-800">
                    {order.items.map((it) => (
                      <li key={it.id}>
                        {it.qty}&times; {it.itemName}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 text-xs text-navy-600">{formatBaht(total)}</div>
                  <button
                    onClick={() => markServed(order.id)}
                    disabled={servingId === order.id}
                    className="mt-2 w-full rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
                  >
                    Mark served
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
