"use client";

import { useState } from "react";
import type { CounterOrder, PaymentMethod } from "@/lib/types";
import SourceBadge, { TrialBadge } from "@/components/SourceBadge";
import CouponPanel from "@/components/bill/CouponPanel";
import DiscountPanel from "@/components/bill/DiscountPanel";
import VoidPanel from "@/components/bill/VoidPanel";

export function formatBaht(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `฿${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function bangkokTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export { SourceBadge };

const STATUS_LABEL: Record<string, string> = {
  pending_pickup: "Pre-order",
  placed: "In kitchen",
  served: "Served",
  paid: "Paid",
  void: "Void",
};

async function post(url: string, body: unknown, method = "POST"): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.error ?? "Something went wrong.";
  } catch {
    return "No connection — try again when you're back online.";
  }
}

type Panel = null | "pay" | "coupon" | "discount" | "void" | "history";

export default function OrderCard({
  order,
  staffId,
  today,
  online,
  locked,
  onChanged,
  onEdit,
  compact,
}: {
  order: CounterOrder;
  staffId: string | null;
  today: string;
  online: boolean;
  locked: boolean;
  onChanged: () => void;
  onEdit: (order: CounterOrder) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // payment panel
  const [payMethod, setPayMethod] = useState<PaymentMethod | "split">("cash");
  const [payAmount, setPayAmount] = useState("");
  // split: cash part typed, online part fills itself in (still editable)
  const [splitCash, setSplitCash] = useState("");
  const [splitOnline, setSplitOnline] = useState("");
  // message after a coupon / discount (e.g. "฿20 still left on it")
  const [info, setInfo] = useState<string | null>(null);
  const [isRefund, setIsRefund] = useState(false);
  const [payDate, setPayDate] = useState(today);
  const [payNote, setPayNote] = useState("");
  // pending coupon resolve
  const [resolveCode, setResolveCode] = useState<Record<number, string>>({});
  // history
  const [history, setHistory] = useState<{ action: string; staffName: string | null; detail: unknown; createdAt: string }[] | null>(null);

  const isVoid = order.status === "void";
  const pendingCoupons = order.coupons.filter((c) => !c.code);
  const owed = Math.max(0, order.outstanding);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) {
      setError(err);
      return false;
    }
    setPanel(null);
    onChanged();
    return true;
  }

  function panelDone(message: string | null) {
    setPanel(null);
    setInfo(message);
    onChanged();
  }

  function openPanel(p: Panel) {
    setError(null);
    setInfo(null);
    setPanel(panel === p ? null : p);
    if (p === "pay") {
      setPayAmount(owed > 0 ? String(owed) : "");
      setSplitCash("");
      setSplitOnline("");
      setIsRefund(false);
      setPayDate(today);
      setPayNote("");
    }
    if (p === "history" && history === null) {
      fetch(`/api/counter/orders/${order.id}/audit`)
        .then((r) => r.json())
        .then((d) => setHistory(d.entries ?? []))
        .catch(() => setHistory([]));
    }
  }

  const headerLabel =
    order.orderType === "pre_order" && order.status === "pending_pickup"
      ? `Pickup ${order.requestedDate ?? ""}${order.requestedTime ? ` ${order.requestedTime.slice(0, 5)}` : ""}`
      : order.dailyOrderNumber
        ? `${order.isTrial ? "Trial " : ""}#${order.dailyOrderNumber}`
        : "Pending";

  const btn = "rounded-md border border-card-border px-2.5 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-40";

  return (
    <div className={`min-w-0 rounded-xl border p-3 ${isVoid ? "border-card-border bg-gray-50 opacity-70" : "border-card-border bg-white"}`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`font-semibold text-navy-950 ${isVoid ? "line-through" : ""}`}>{headerLabel}</span>
            <SourceBadge source={order.source} />
            {order.isTrial && <TrialBadge />}
            <span className="text-xs text-navy-600">{bangkokTime(order.createdAt)}</span>
            {order.customerLabel && <span className="truncate text-xs font-medium text-navy-800">· {order.customerLabel}</span>}
            {order.seatId && <span className="text-xs text-navy-600">· {order.seatId}</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-navy-700">
            {order.items.map((it) => `${it.qty}× ${it.itemName}`).join(", ")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-navy-950">{formatBaht(isVoid ? 0 : order.net)}</p>
          <p className="text-[11px] text-navy-600">{STATUS_LABEL[order.status] ?? order.status}</p>
          {!isVoid && owed > 0 && <p className="text-[11px] font-semibold text-status-out">Owes {formatBaht(owed)}</p>}
          {!isVoid && order.outstanding < -0.005 && <p className="text-[11px] font-semibold text-status-low">Overpaid {formatBaht(-order.outstanding)}</p>}
          {!isVoid && pendingCoupons.length > 0 && <p className="text-[11px] font-semibold text-status-low">Coupon code pending</p>}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-card-border pt-3 text-sm">
          {isVoid && <p className="text-xs text-status-out">Voided{order.voidReason ? `: ${order.voidReason}` : ""}</p>}
          <ul className="space-y-0.5 text-navy-800">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-2">
                <span>
                  {it.qty}× {it.itemName}
                  {it.fulfillmentType === "takeaway" && <span className="ml-1 text-[10px] font-semibold uppercase text-status-low">Takeaway</span>}
                  {it.note && <span className="ml-1 text-xs italic text-navy-600">“{it.note}”</span>}
                </span>
                <span className="text-navy-600">{formatBaht(it.qty * it.priceAtOrder)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-0.5 text-xs text-navy-700">
            <div className="flex justify-between"><span>Items</span><span>{formatBaht(order.gross)}</span></div>
            {order.manualDiscountAmount > 0 && (
              <div className="flex justify-between">
                <span>Discount{order.manualDiscountPct ? ` ${order.manualDiscountPct}%` : ""}{order.discountNote ? ` (${order.discountNote})` : ""}</span>
                <span>−{formatBaht(order.manualDiscountAmount)}</span>
              </div>
            )}
            {order.coupons.map((c) => (
              <div key={c.id} className="flex justify-between">
                <span>
                  Coupon{" "}
                  {c.code ??
                    (isVoid ? (
                      `${c.attemptedCode ?? ""} (given back)`
                    ) : (
                      <span className="font-semibold text-status-low">code pending{c.attemptedCode ? ` (tried ${c.attemptedCode})` : ""}</span>
                    ))}
                </span>
                <span>−{formatBaht(c.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-navy-950"><span>To pay</span><span>{formatBaht(order.net)}</span></div>
            {order.staffName && <p className="text-navy-600">Taken by {order.staffName}</p>}
          </div>

          {pendingCoupons.length > 0 && !isVoid && (
            <div className="space-y-1 rounded-lg bg-amber-50 p-2">
              {pendingCoupons.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span>Code for the coupon that took {formatBaht(c.amount)} off:</span>
                  <input
                    value={resolveCode[c.id] ?? ""}
                    onChange={(e) => setResolveCode({ ...resolveCode, [c.id]: e.target.value })}
                    placeholder="Coupon code"
                    className="w-28 rounded-md border border-card-border px-2 py-1"
                  />
                  <button
                    type="button"
                    disabled={busy || !online || !(resolveCode[c.id] ?? "").trim()}
                    onClick={() => run(() => post(`/api/counter/coupons/${c.id}`, { code: resolveCode[c.id], staffId }))}
                    className={btn}
                  >
                    Save code
                  </button>
                </div>
              ))}
            </div>
          )}

          {!isVoid && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!online || locked} onClick={() => openPanel("pay")} className={btn}>
                Payment / refund
              </button>
              <button type="button" disabled={!online || locked} onClick={() => openPanel("coupon")} className={btn}>
                Add coupon
              </button>
              {order.source !== "counter" && (
                <button type="button" disabled={!online || locked} onClick={() => openPanel("discount")} className={btn}>
                  Discount
                </button>
              )}
              {order.source === "counter" && !compact && (
                <button type="button" disabled={!online || locked} onClick={() => onEdit(order)} className={btn}>
                  Edit order
                </button>
              )}
              <button type="button" disabled={!online || locked} onClick={() => openPanel("void")} className={`${btn} text-status-out`}>
                Void
              </button>
              <button type="button" disabled={!online} onClick={() => openPanel("history")} className={btn}>
                History
              </button>
            </div>
          )}
          {isVoid && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!online} onClick={() => openPanel("history")} className={btn}>
                History
              </button>
              <button
                type="button"
                disabled={!online || locked || busy}
                onClick={() => {
                  if (window.confirm(`Delete this voided order for good? It disappears completely, including its history. This can't be undone.`)) {
                    run(() => post(`/api/counter/orders/${order.id}`, undefined, "DELETE"));
                  }
                }}
                className={`${btn} text-status-out`}
              >
                Delete for good
              </button>
            </div>
          )}
          {locked && !isVoid && <p className="text-xs text-navy-600">This day is locked — unlock it on the summary to change orders.</p>}

          {panel === "pay" && (
            <div className="space-y-2 rounded-lg bg-navy-100/60 p-3">
              {order.payments.length > 0 && (
                <div className="space-y-0.5 border-b border-card-border pb-2 text-xs text-navy-700">
                  <p className="font-semibold text-navy-800">Recorded so far</p>
                  {order.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span>
                  {p.amount < 0 ? "Refund" : "Paid"} {p.method === "cash" ? "cash" : "online"}
                  {p.receivedOn !== order.orderDate ? ` on ${p.receivedOn}` : ""}
                  {p.staffName ? ` · ${p.staffName}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  {formatBaht(p.amount)}
                  {!locked && online && !isVoid && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove this ${formatBaht(p.amount)} ${p.method} payment record?`)) {
                          run(() => post(`/api/counter/payments/${p.id}?staffId=${staffId ?? ""}`, undefined, "DELETE"));
                        }
                      }}
                      className="text-[11px] text-status-out underline"
                    >
                      remove
                    </button>
                  )}
                </span>
              </div>
            ))}
                </div>
              )}
              <div className="flex gap-2">
                {(["cash", "online", "split"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPayMethod(m);
                      if (m === "split") setIsRefund(false);
                    }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${payMethod === m ? "bg-navy-900 text-white" : "border border-card-border bg-white text-navy-900"}`}
                  >
                    {m === "cash" ? "Cash" : m === "online" ? "Online" : "Split"}
                  </button>
                ))}
              </div>
              {payMethod !== "split" && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} />
                  This is a refund (money given back)
                </label>
              )}
              {payMethod === "split" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-navy-700">
                    Cash ฿
                    <input
                      inputMode="decimal"
                      value={splitCash}
                      onChange={(e) => {
                        setSplitCash(e.target.value);
                        const rest = Math.round((owed - (Number(e.target.value) || 0)) * 100) / 100;
                        setSplitOnline(rest > 0 ? String(rest) : "");
                      }}
                      className="mt-0.5 w-full rounded-md border border-card-border px-2 py-1.5"
                    />
                  </label>
                  <label className="text-xs text-navy-700">
                    Online ฿
                    <input inputMode="decimal" value={splitOnline} onChange={(e) => setSplitOnline(e.target.value)} className="mt-0.5 w-full rounded-md border border-card-border px-2 py-1.5" />
                  </label>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {payMethod !== "split" && (
                  <input
                    inputMode="decimal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount ฿"
                    className="w-28 rounded-md border border-card-border px-2 py-1.5"
                  />
                )}
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="rounded-md border border-card-border px-2 py-1.5" />
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" className="min-w-0 flex-1 rounded-md border border-card-border px-2 py-1.5" />
              </div>
              {payMethod === "split" && owed > 0 && (
                <p className="text-[11px] text-navy-600">
                  Type the cash part — the rest of the {formatBaht(owed)} owed fills in as online.
                </p>
              )}
              <p className="text-[11px] text-navy-600">Date = the day the money changed hands (it counts toward that day&rsquo;s cash drawer).</p>
              <button
                type="button"
                disabled={busy || (payMethod === "split" ? !(Number(splitCash) > 0 && Number(splitOnline) > 0) : !(Number(payAmount) > 0))}
                onClick={() =>
                  run(() =>
                    post(
                      `/api/counter/orders/${order.id}/payments`,
                      payMethod === "split"
                        ? { method: "split", cash: Number(splitCash), online: Number(splitOnline), receivedOn: payDate, note: payNote, staffId }
                        : {
                            method: payMethod,
                            amount: (isRefund ? -1 : 1) * Number(payAmount),
                            receivedOn: payDate,
                            note: payNote,
                            staffId,
                          }
                    )
                  )
                }
                className="w-full rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {payMethod === "split"
                  ? `Record split · ${formatBaht((Number(splitCash) || 0) + (Number(splitOnline) || 0))}`
                  : isRefund
                    ? "Record refund"
                    : "Record payment"}
              </button>
            </div>
          )}

          {panel === "coupon" && <CouponPanel orderId={order.id} staffId={staffId} isTrial={order.isTrial} onDone={panelDone} />}

          {panel === "discount" && (
            <DiscountPanel
              orderId={order.id}
              staffId={staffId}
              gross={order.gross}
              currentPct={order.manualDiscountPct}
              currentAmount={order.manualDiscountAmount}
              currentNote={order.discountNote}
              onDone={panelDone}
            />
          )}

          {panel === "void" && <VoidPanel orderId={order.id} staffId={staffId} onDone={panelDone} />}

          {panel === "history" && (
            <div className="rounded-lg bg-navy-100/60 p-3 text-xs">
              {history === null ? (
                <p>Loading…</p>
              ) : history.length === 0 ? (
                <p>No changes recorded.</p>
              ) : (
                <ul className="space-y-1">
                  {history.map((h, i) => (
                    <li key={i}>
                      <span className="font-medium">{new Date(h.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}</span> — {h.action.replace(/_/g, " ")}
                      {h.staffName ? ` by ${h.staffName}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-xs text-status-out">{error}</p>}
          {info && <p className="rounded-md bg-green-50 px-2 py-1 text-xs text-status-good">{info}</p>}
        </div>
      )}
    </div>
  );
}
