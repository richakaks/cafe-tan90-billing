"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderRow } from "@/lib/types";
import SourceBadge, { TrialBadge } from "@/components/SourceBadge";
import CouponPanel from "@/components/bill/CouponPanel";
import DiscountPanel from "@/components/bill/DiscountPanel";
import VoidPanel from "@/components/bill/VoidPanel";
import { postJson } from "@/components/bill/api";

const POLL_MS = 8000;
const PICKUP_BUCKET = "Pickup (pre-order)";
// Same key the counter uses, so Billing actions are logged under whoever
// is picked on this tablet's counter screen (if anyone).
const STAFF_KEY = "tan90_counter_staff_v1";

function formatBaht(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `฿${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function orderTotals(order: OrderRow) {
  const gross = order.items.reduce((sum, it) => sum + it.qty * it.priceAtOrder, 0);
  const net = Math.max(0, gross - order.discountAmount);
  // Round 32: counter orders may be partly paid already (deposit / split);
  // the Cash / Online buttons then record only what's still owed.
  const due = Math.max(0, Math.round((net - order.amountPaid) * 100) / 100);
  return { gross, net, due };
}

type PaymentMethod = "cash" | "online";

// Cash / Online / Split side by side -- the choice itself is the action
// (Round 17). Split asks for the cash part; the rest is recorded as online.
function PayButtons({
  busy,
  filled,
  due,
  onPick,
  onSplit,
}: {
  busy: boolean;
  filled?: boolean;
  due: number;
  onPick: (method: PaymentMethod) => void;
  onSplit: (cash: number) => void;
}) {
  const [splitOpen, setSplitOpen] = useState(false);
  const [cash, setCash] = useState("");
  const base = filled
    ? "flex-1 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
    : "flex-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-100 disabled:opacity-50";
  const cashNum = Number(cash) || 0;
  const online = Math.round((due - cashNum) * 100) / 100;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <button onClick={() => onPick("cash")} disabled={busy} className={base}>
          {busy ? "…" : "💵 Cash"}
        </button>
        <button onClick={() => onPick("online")} disabled={busy} className={base}>
          {busy ? "…" : "💳 Online"}
        </button>
        <button onClick={() => setSplitOpen(!splitOpen)} disabled={busy || due <= 0} className={`${base} ${splitOpen ? "ring-2 ring-navy-700" : ""}`}>
          {busy ? "…" : "½ Split"}
        </button>
      </div>
      {splitOpen && (
        <div className="space-y-2 rounded-lg bg-navy-100/60 p-3 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs text-navy-700">
              Cash ฿
              <input
                inputMode="decimal"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="ml-1 w-24 rounded-md border border-card-border bg-white px-2 py-1.5"
              />
            </label>
            <span className="text-xs text-navy-700">
              + Online <span className="font-semibold">{formatBaht(Math.max(0, online))}</span>
            </span>
          </div>
          {cashNum > due + 0.005 && <p className="text-xs text-status-out">Cash is more than the {formatBaht(due)} owed.</p>}
          <button
            disabled={busy || !(cashNum > 0) || !(online > 0)}
            onClick={() => {
              onSplit(cashNum);
              setSplitOpen(false);
              setCash("");
            }}
            className="w-full rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Mark paid · {formatBaht(cashNum)} cash + {formatBaht(Math.max(0, online))} online
          </button>
        </div>
      )}
    </div>
  );
}

type Panel = "coupon" | "discount" | "void";

function BillOrder({ order, staffId, onChanged }: { order: OrderRow; staffId: string | null; onChanged: () => void }) {
  const { gross, net } = orderTotals(order);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resolveCode, setResolveCode] = useState<Record<number, string>>({});
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function done(message: string | null) {
    setPanel(null);
    setInfo(message);
    onChanged();
  }

  async function resolve(id: number) {
    setBusy(true);
    setResolveError(null);
    const { error } = await postJson(`/api/counter/coupons/${id}`, { code: resolveCode[id], staffId });
    setBusy(false);
    if (error) {
      setResolveError(error);
      return;
    }
    done("Coupon code saved.");
  }

  const small = "rounded-md border border-card-border px-2.5 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100";
  const pending = order.coupons.filter((c) => !c.code);

  return (
    <>
      <div className="mt-1 space-y-0.5 text-xs text-navy-700">
        {(order.manualDiscountAmount > 0 || order.coupons.length > 0) && (
          <div className="flex justify-between">
            <span>Items</span>
            <span>{formatBaht(gross)}</span>
          </div>
        )}
        {order.manualDiscountAmount > 0 && (
          <div className="flex justify-between">
            <span>
              Discount{order.manualDiscountPct ? ` ${order.manualDiscountPct}%` : ""}
              {order.discountNote ? ` (${order.discountNote})` : ""}
            </span>
            <span>−{formatBaht(order.manualDiscountAmount)}</span>
          </div>
        )}
        {order.coupons.map((c) => (
          <div key={c.id} className="flex justify-between">
            <span>Coupon {c.code ?? <span className="font-semibold text-status-low">code pending</span>}</span>
            <span>−{formatBaht(c.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold text-navy-950">
          <span>To pay</span>
          <span>{formatBaht(net)}</span>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2">
          {pending.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span>Code for the coupon that took {formatBaht(c.amount)} off:</span>
              <input
                value={resolveCode[c.id] ?? ""}
                onChange={(e) => setResolveCode({ ...resolveCode, [c.id]: e.target.value })}
                placeholder="Coupon code"
                className="w-28 rounded-md border border-card-border bg-white px-2 py-1"
              />
              <button type="button" disabled={busy || !(resolveCode[c.id] ?? "").trim()} onClick={() => resolve(c.id)} className={small}>
                Save code
              </button>
            </div>
          ))}
          {resolveError && <p className="text-xs text-status-out">{resolveError}</p>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["coupon", "discount", "void"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setInfo(null);
              setPanel(panel === p ? null : p);
            }}
            className={`${small} ${p === "void" ? "text-status-out" : ""} ${panel === p ? "bg-navy-100" : ""}`}
          >
            {p === "coupon" ? "Coupon" : p === "discount" ? "Discount" : "Void"}
          </button>
        ))}
      </div>
      {panel && (
        <div className="mt-2">
          {panel === "coupon" && <CouponPanel orderId={order.id} staffId={staffId} isTrial={order.isTrial} onDone={done} />}
          {panel === "discount" && (
            <DiscountPanel
              orderId={order.id}
              staffId={staffId}
              gross={gross}
              currentPct={order.manualDiscountPct}
              currentAmount={order.manualDiscountAmount}
              currentNote={order.discountNote}
              onDone={done}
            />
          )}
          {panel === "void" && <VoidPanel orderId={order.id} staffId={staffId} onDone={done} />}
        </div>
      )}
      {info && <p className="mt-2 rounded-md bg-green-50 px-2 py-1 text-xs text-status-good">{info}</p>}
    </>
  );
}

export default function BillingClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [payError, setPayError] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
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
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this tablet's storage after mount
      setStaffId(window.localStorage.getItem(STAFF_KEY));
    } catch {
      // storage blocked -- actions are just logged without a name
    }
    timer.current = setInterval(refresh, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const bySeat = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const order of orders) {
      const key = order.isTrial
        ? "Trial orders (practice — not counted)"
        : (order.seatId ?? (order.source === "counter" ? (order.customerLabel ? `Counter · ${order.customerLabel}` : "Counter") : PICKUP_BUCKET));
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  async function settle(orderIds: string[], url: string, body: unknown) {
    setPayingIds((prev) => new Set([...prev, ...orderIds]));
    setPayError(null);
    try {
      const { error } = await postJson(url, body);
      if (error) {
        setPayError(error);
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

  const pay = (orderIds: string[], paymentMethod: PaymentMethod) => settle(orderIds, "/api/orders/pay", { orderIds, paymentMethod });
  const paySplit = (orderIds: string[], cash: number) => settle(orderIds, "/api/orders/pay-split", { orderIds, cash, staffId });

  if (orders.length === 0) {
    return <p className="card p-6 text-sm text-navy-600">Nothing waiting on a bill right now.</p>;
  }

  return (
    <div className="space-y-6">
      {payError && <p className="text-sm text-status-out">{payError}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {bySeat.map(([seatKey, seatOrders]) => {
          const combinedGross = seatOrders.reduce((sum, o) => sum + orderTotals(o).gross, 0);
          const combinedDue = seatOrders.reduce((sum, o) => sum + orderTotals(o).due, 0);
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
                  const { due } = orderTotals(order);
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
                      <BillOrder order={order} staffId={staffId} onChanged={refresh} />
                      {order.amountPaid !== 0 && (
                        <p className="mt-1 text-xs text-navy-700">
                          Already paid {formatBaht(order.amountPaid)} &middot; <span className="font-semibold">still owed {formatBaht(due)}</span>
                        </p>
                      )}
                      <p className="mt-2 text-xs text-navy-600">Mark paid — how?</p>
                      <PayButtons busy={payingIds.has(order.id)} due={due} onPick={(method) => pay([order.id], method)} onSplit={(cash) => paySplit([order.id], cash)} />
                    </div>
                  );
                })}
              </div>

              {seatOrders.length > 1 && (
                <div className="mt-4 border-t border-card-border pt-4">
                  <div className="flex justify-between text-sm font-semibold text-navy-950">
                    <span>Combined total</span>
                    <span>
                      {combinedGross !== combinedDue ? (
                        <>
                          <span className="mr-1 font-normal text-navy-600 line-through">{formatBaht(combinedGross)}</span>
                          {formatBaht(combinedDue)}
                        </>
                      ) : (
                        formatBaht(combinedDue)
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-navy-600">Bill together — mark all paid, how?</p>
                  <PayButtons busy={anyBusy} filled due={combinedDue} onPick={(method) => pay(allIds, method)} onSplit={(cash) => paySplit(allIds, cash)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
