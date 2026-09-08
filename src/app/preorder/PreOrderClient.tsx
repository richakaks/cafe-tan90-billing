"use client";

import { useMemo, useState } from "react";
import type { FulfillmentType, MenuItemWithAvailability, PlacedPreOrder } from "@/lib/types";

type CartEntry = { qty: number; fulfillmentType: FulfillmentType };

const STATUS_BADGE: Record<string, { label: string; className: string } | null> = {
  in_stock: null,
  low_stock: { label: "Low in stock", className: "bg-amber-50 text-status-low border border-amber-200" },
  out_of_stock: null, // pre-orders don't block on today's stock — it's fulfilled on the requested date
};

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export default function PreOrderClient({ initialMenu }: { initialMenu: MenuItemWithAvailability[] }) {
  const [menu] = useState(initialMenu);
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [basketOpen, setBasketOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PlacedPreOrder | null>(null);

  const [date, setDate] = useState(todayIso());
  const [timeMode, setTimeMode] = useState<"any" | "specific">("any");
  const [time, setTime] = useState("12:00");

  const byCategory = useMemo(() => {
    const map = new Map<string, MenuItemWithAvailability[]>();
    for (const item of menu) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [menu]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, entry]) => entry.qty > 0)
        .map(([code, entry]) => ({ item: menu.find((m) => m.code === code)!, qty: entry.qty, fulfillmentType: entry.fulfillmentType }))
        .filter((l) => l.item),
    [cart, menu]
  );

  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.qty * l.item.price, 0);

  function setQty(code: string, qty: number) {
    setCart((prev) => ({
      ...prev,
      [code]: { qty: Math.max(0, qty), fulfillmentType: prev[code]?.fulfillmentType ?? "dine_in" },
    }));
  }

  function setFulfillment(code: string, fulfillmentType: FulfillmentType) {
    setCart((prev) => (prev[code] ? { ...prev, [code]: { ...prev[code], fulfillmentType } } : prev));
  }

  async function submit() {
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/preorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedDate: date,
          requestedTime: timeMode === "specific" ? time : null,
          items: cartLines.map((l) => ({ code: l.item.code, qty: l.qty, fulfillmentType: l.fulfillmentType })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong placing your pre-order. Please try again.");
        return;
      }
      setConfirmation(body.order as PlacedPreOrder);
      setCart({});
      setBasketOpen(false);
    } catch {
      setError("Couldn't reach the kitchen — check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (confirmation) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="card w-full max-w-sm p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-status-good">Pre-order placed</p>
          <h1 className="mt-2 text-xl font-semibold text-navy-950">
            {new Date(confirmation.requestedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h1>
          <p className="mt-1 text-sm text-navy-700">{confirmation.requestedTime ? `Around ${confirmation.requestedTime.slice(0, 5)}` : "Any time within opening hours"}</p>

          <ul className="mt-6 space-y-1 text-left text-sm text-navy-800">
            {confirmation.items.map((it) => (
              <li key={it.code} className="flex justify-between">
                <span>
                  {it.qty}&times; {it.name}
                  <span className="ml-1.5 text-xs text-navy-500">({it.fulfillmentType === "takeaway" ? "Takeaway" : "Dine In"})</span>
                </span>
                <span>{formatBaht(it.qty * it.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-card-border pt-3 text-sm font-semibold text-navy-950">
            <span>Total</span>
            <span>{formatBaht(confirmation.total)}</span>
          </div>

          <p className="mt-6 text-xs text-navy-600">Please pay a staff member when you pick up your order.</p>

          <button
            onClick={() => setConfirmation(null)}
            className="mt-6 w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-100"
          >
            Place another pre-order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-28">
      <header className="bg-navy-950 px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-100">Cafe Tan90</p>
        <h1 className="mt-1 text-xl font-semibold">Pre-order</h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <section className="card mb-6 p-4">
          <h2 className="text-sm font-semibold text-navy-950">When would you like it?</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-navy-800">
              Date
              <input
                type="date"
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-card-border px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-4 text-sm text-navy-800">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={timeMode === "any"} onChange={() => setTimeMode("any")} />
                Any time within opening hours
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={timeMode === "specific"} onChange={() => setTimeMode("specific")} />
                Specific time
              </label>
            </div>
            {timeMode === "specific" && (
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-32 rounded-md border border-card-border px-3 py-2 text-sm"
              />
            )}
          </div>
        </section>

        {byCategory.map(([category, items]) => (
          <section key={category} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-600">{category}</h2>
            <div className="space-y-3">
              {items.map((item) => {
                const badge = STATUS_BADGE[item.status];
                const qty = cart[item.code]?.qty ?? 0;
                return (
                  <div key={item.code} className="card flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy-950">{item.name}</p>
                        <p className="text-sm text-navy-600">{formatBaht(item.price)}</p>
                        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-navy-500">{item.description}</p>}
                        {badge && (
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
                        )}
                      </div>
                    </div>

                    {qty === 0 ? (
                      <button
                        onClick={() => setQty(item.code, 1)}
                        className="shrink-0 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800"
                      >
                        Add
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setQty(item.code, qty - 1)}
                          aria-label={`Remove one ${item.name}`}
                          className="h-8 w-8 rounded-full border border-card-border text-navy-900 transition hover:bg-navy-100"
                        >
                          −
                        </button>
                        <span className="w-4 text-center text-sm font-medium">{qty}</span>
                        <button
                          onClick={() => setQty(item.code, qty + 1)}
                          aria-label={`Add one more ${item.name}`}
                          className="h-8 w-8 rounded-full border border-card-border text-navy-900 transition hover:bg-navy-100"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {cartCount > 0 && !basketOpen && (
        <button
          onClick={() => setBasketOpen(true)}
          className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between rounded-xl bg-navy-900 px-5 py-4 text-white shadow-lg"
        >
          <span className="text-sm font-medium">
            {cartCount} item{cartCount === 1 ? "" : "s"}
          </span>
          <span className="text-sm font-semibold">View basket &middot; {formatBaht(cartTotal)}</span>
        </button>
      )}

      {basketOpen && (
        <div className="fixed inset-0 z-10 flex items-end bg-navy-950/40" onClick={() => setBasketOpen(false)}>
          <div className="card mx-auto w-full max-w-md rounded-b-none p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-navy-950">Your pre-order</h2>

            <ul className="mt-4 max-h-[35vh] space-y-3 overflow-y-auto">
              {cartLines.map((l) => (
                <li key={l.item.code} className="space-y-2 border-b border-card-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-950">{l.item.name}</p>
                      <p className="text-xs text-navy-600">{formatBaht(l.item.price)} each</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setQty(l.item.code, l.qty - 1)}
                        className="h-8 w-8 rounded-full border border-card-border text-navy-900 transition hover:bg-navy-100"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm font-medium">{l.qty}</span>
                      <button
                        onClick={() => setQty(l.item.code, l.qty + 1)}
                        className="h-8 w-8 rounded-full border border-card-border text-navy-900 transition hover:bg-navy-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {(["dine_in", "takeaway"] as const).map((ft) => (
                      <button
                        key={ft}
                        onClick={() => setFulfillment(l.item.code, ft)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          l.fulfillmentType === ft ? "bg-navy-900 text-white" : "border border-card-border text-navy-700 hover:bg-navy-100"
                        }`}
                      >
                        {ft === "dine_in" ? "Dine In" : "Takeaway"}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-card-border pt-4 text-sm text-navy-800">
              <div className="flex justify-between">
                <span>Pickup</span>
                <span>
                  {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {timeMode === "specific" ? ` around ${time}` : " · any time"}
                </span>
              </div>
              <div className="mt-1 flex justify-between font-semibold text-navy-950">
                <span>Total</span>
                <span>{formatBaht(cartTotal)}</span>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-status-out">{error}</p>}

            <button
              onClick={submit}
              disabled={placing || cartLines.length === 0}
              className="mt-5 w-full rounded-lg bg-navy-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
            >
              {placing ? "Placing pre-order…" : "Place pre-order"}
            </button>
            <button
              onClick={() => setBasketOpen(false)}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-navy-700"
            >
              Keep browsing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
