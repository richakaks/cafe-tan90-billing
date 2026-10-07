"use client";

import { useCallback, useEffect, useState } from "react";

// Round 38: owner switches "QR orders take stock off" / "Counter orders take
// stock off". The full card (both switches + "earlier orders") lives on the
// Inventory page; the counter and serving screens show a compact switch for
// their own kind of order.

type Source = "qr" | "counter";
type Meta = { qrOn: boolean; counterOn: boolean; lastStockCount: string | null };
type Row = { orderId: string; orderDate: string; number: number | null; items: string; status: "will_add" | "already" | "before_count" };

const LABEL: Record<Source, string> = { qr: "QR orders", counter: "Counter orders" };

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales-stock", { cache: "no-store" });
      if (res.ok) setMeta(await res.json());
    } catch {
      // offline -- leave as is
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on mount
    load();
  }, [load]);
  return { meta, setMeta, load };
}

async function setSwitch(source: Source, on: boolean): Promise<Meta | string> {
  try {
    const res = await fetch("/api/sales-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, on }),
    });
    const data = await res.json();
    return res.ok ? (data as Meta) : (data.error ?? "Could not change the switch.");
  } catch {
    return "No connection.";
  }
}

function Toggle({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-status-good" : "bg-navy-600/40"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function confirmText(source: Source, on: boolean): string {
  if (on) {
    return `Turn ON: ${LABEL[source]} take their ingredients off stock from now on.${
      source === "counter" ? " A counter sale is never refused — if something runs out, its stock goes below zero and the order shows a warning." : ""
    }\n\nOrders taken while it was off are not touched — use "Earlier orders" on the Inventory page for those.`;
  }
  return `Turn OFF: ${LABEL[source]} stop taking anything off stock.${source === "qr" ? " The QR menu also stops showing items as sold out." : ""}`;
}

// Compact one-line switch for the Counter / Serving screens.
export function SalesStockToggle({ source }: { source: Source }) {
  const { meta, setMeta } = useMeta();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!meta) return null;
  const on = source === "qr" ? meta.qrOn : meta.counterOn;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Toggle
        on={on}
        busy={busy}
        onClick={async () => {
          if (!window.confirm(confirmText(source, !on))) return;
          setBusy(true);
          setError(null);
          const r = await setSwitch(source, !on);
          setBusy(false);
          if (typeof r === "string") setError(r);
          else setMeta(r);
        }}
      />
      <span className="text-navy-800">
        {LABEL[source]} take stock off: <b className={on ? "text-status-good" : "text-navy-600"}>{on ? "ON" : "OFF"}</b>
      </span>
      <a href="/admin/inventory#sales-stock" className="text-xs text-navy-700 underline">
        settings
      </a>
      {error && <span className="text-xs text-status-out">{error}</span>}
    </div>
  );
}

function EarlierOrders({ source, lastStockCount, onClose }: { source: Source; lastStockCount: string | null; onClose: () => void }) {
  const today = todayIso();
  const [mode, setMode] = useState<"count" | "range">(lastStockCount ? "count" : "range");
  const [from, setFrom] = useState(addDays(today, -7));
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const qs = mode === "count" ? "" : `&from=${from}&to=${to}`;
  const willAdd = (rows ?? []).filter((r) => r.status === "will_add");

  async function preview() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/sales-stock/backfill?source=${source}${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Could not load the preview.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sales-stock/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "count" ? { source } : { source, from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(null);
      setMsg(`Done — stock taken off for ${data.count} order${data.count === 1 ? "" : "s"}.`);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Could not take the stock off.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-navy-700/30 bg-navy-100/50 p-3 text-sm">
      <p className="font-semibold text-navy-950">Take stock off for earlier {LABEL[source].toLowerCase()}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!lastStockCount}
          onClick={() => {
            setMode("count");
            setRows(null);
          }}
          className={`rounded-md px-3 py-1.5 ${mode === "count" ? "bg-navy-900 text-white" : "border border-card-border bg-white"} disabled:opacity-40`}
        >
          Since the last stock count
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("range");
            setRows(null);
          }}
          className={`rounded-md px-3 py-1.5 ${mode === "range" ? "bg-navy-900 text-white" : "border border-card-border bg-white"}`}
        >
          Pick dates
        </button>
      </div>
      {mode === "count" && lastStockCount && <p className="text-xs text-navy-700">Last full stock count: {fmt(lastStockCount)}</p>}
      {!lastStockCount && <p className="text-xs text-status-low">Record a full stock count first (card above) — orders before it are already in that count.</p>}
      {mode === "range" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          From{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setRows(null);
            }}
            className="rounded-md border border-card-border px-2 py-1"
          />
          to{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setRows(null);
            }}
            className="rounded-md border border-card-border px-2 py-1"
          />
        </div>
      )}
      <p className="text-[11px] text-navy-600">
        An order is never counted twice: anything already taken off, or placed before the last full stock count, is skipped.
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={preview} className="rounded-md border border-card-border bg-white px-3 py-1.5 font-medium">
          {busy && !rows ? "Loading…" : "Preview"}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-navy-700 underline">
          Close
        </button>
      </div>
      {rows && (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-navy-600">No orders in that period.</p>
          ) : (
            <>
              <p className="text-navy-900">
                <b>{willAdd.length}</b> order{willAdd.length === 1 ? "" : "s"} will take stock off; {rows.length - willAdd.length} skipped.
              </p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-md bg-white p-2 text-xs">
                {rows.map((r) => (
                  <li key={r.orderId} className={r.status === "will_add" ? "" : "text-navy-600 line-through"}>
                    {r.orderDate} · #{r.number ?? "—"} · {r.items}
                    {r.status === "already" ? " (already taken off)" : r.status === "before_count" ? " (before the stock count)" : ""}
                  </li>
                ))}
              </ul>
              {willAdd.length > 0 && (
                <button type="button" disabled={busy} onClick={apply} className="rounded-md bg-navy-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
                  Take stock off for {willAdd.length} order{willAdd.length === 1 ? "" : "s"}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {msg && <p className="text-xs text-navy-800">{msg}</p>}
    </div>
  );
}

// Full card for the Inventory page.
export default function SalesStockCard() {
  const { meta, setMeta } = useMeta();
  const [busy, setBusy] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<Source | null>(null);
  if (!meta) return null;

  return (
    <div id="sales-stock" className="card scroll-mt-4 space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-navy-950">Sales take stock off</h2>
        <p className="mt-1 text-xs text-navy-600">
          When a switch is on, every order of that kind takes its ingredients (and cups, boxes, straws) off stock. Voiding an order gives them back; editing an
          order moves only the difference.
        </p>
      </div>
      {(["qr", "counter"] as const).map((source) => {
        const on = source === "qr" ? meta.qrOn : meta.counterOn;
        return (
          <div key={source} className="rounded-lg border border-card-border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Toggle
                on={on}
                busy={busy === source}
                onClick={async () => {
                  if (!window.confirm(confirmText(source, !on))) return;
                  setBusy(source);
                  setError(null);
                  const r = await setSwitch(source, !on);
                  setBusy(null);
                  if (typeof r === "string") setError(r);
                  else setMeta(r);
                }}
              />
              <span className="text-sm font-medium text-navy-950">
                {LABEL[source]}: <span className={on ? "text-status-good" : "text-navy-600"}>{on ? "ON" : "OFF"}</span>
              </span>
              <button type="button" onClick={() => setEarlier(earlier === source ? null : source)} className="text-xs text-navy-700 underline">
                Earlier orders…
              </button>
            </div>
            <p className="mt-1 text-[11px] text-navy-600">
              {source === "qr"
                ? "While on, a QR order is refused if an item is out of stock, and sold-out items show as unavailable on the QR menu."
                : "While on, a counter sale is never refused: if something runs out its stock goes below zero and the order shows a warning."}
            </p>
            {earlier === source && <EarlierOrders source={source} lastStockCount={meta.lastStockCount} onClose={() => setEarlier(null)} />}
          </div>
        );
      })}
      {error && <p className="text-xs text-status-out">{error}</p>}
    </div>
  );
}
