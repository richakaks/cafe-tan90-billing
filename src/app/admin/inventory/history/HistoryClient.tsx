"use client";

import { useEffect, useState } from "react";
import type { StockAdjustmentRow } from "@/lib/types";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HistoryClient() {
  // The on-screen list defaults to the last week — enough to browse without
  // asking Postgres for everything every time. The CSV export below has its
  // own, independent range (defaults to the last month) so you can pull a
  // longer or older window — including previous months — without changing
  // what's shown on screen.
  const [viewFrom, setViewFrom] = useState(daysAgoIso(6));
  const [viewTo, setViewTo] = useState(todayIso());
  const [adjustments, setAdjustments] = useState<StockAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exportFrom, setExportFrom] = useState(daysAgoIso(29));
  const [exportTo, setExportTo] = useState(todayIso());

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    fetch(`/api/inventory/history/range?from=${viewFrom}&to=${viewTo}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "Could not load history.");
          return;
        }
        setAdjustments(body.adjustments as StockAdjustmentRow[]);
      })
      .catch(() => !cancelled && setError("Could not load history."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [viewFrom, viewTo]);

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <label className="flex flex-col gap-1 text-sm text-navy-800">
          From
          <input type="date" value={viewFrom} onChange={(e) => setViewFrom(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-navy-800">
          To
          <input type="date" value={viewTo} onChange={(e) => setViewTo(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setViewFrom(daysAgoIso(6));
              setViewTo(todayIso());
            }}
            className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
          >
            Last 7 days
          </button>
          <button
            onClick={() => {
              setViewFrom(`${todayIso().slice(0, 7)}-01`);
              setViewTo(todayIso());
            }}
            className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
          >
            This month
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-status-out">{error}</p>}
      {loading && <p className="text-sm text-navy-600">Loading…</p>}

      {!loading && !error && (
        <div className="card p-5">
          {adjustments.length === 0 ? (
            <p className="text-sm text-navy-600">No stock changes in this range.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {adjustments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="text-navy-900">{a.ingredientName}</span>
                  <span className={a.delta >= 0 ? "text-status-good" : "text-navy-700"}>
                    {a.delta >= 0 ? "+" : ""}
                    {a.delta} &rarr; {a.resultingStock}
                  </span>
                  <span className="shrink-0 text-xs text-navy-600">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Export as CSV</h2>
        <p className="mt-1 text-xs text-navy-600">
          Pick any range, including previous months — this is separate from the range shown above.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-navy-800">
            From
            <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-800">
            To
            <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
          </label>
          <a
            href={`/api/inventory/history/export?from=${exportFrom}&to=${exportTo}`}
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            Download CSV
          </a>
        </div>
      </div>
    </div>
  );
}
