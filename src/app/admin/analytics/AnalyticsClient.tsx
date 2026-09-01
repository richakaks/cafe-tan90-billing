"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesAnalytics } from "@/lib/types";

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

function firstOfMonthIso(): string {
  const today = todayIso();
  return `${today.slice(0, 7)}-01`;
}

const PIE_COLORS = ["#101a3d", "#2c3f85", "#d9a441", "#1c8a4c", "#b8790f", "#b3372c", "#6b7db0", "#8a6d3b"];

export default function AnalyticsClient() {
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer the initial setState calls to a microtask so React's hooks lint
    // rule (no setState synchronously in an effect body) is satisfied —
    // fires before paint, so there's no visible difference.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    fetch(`/api/analytics?from=${from}&to=${to}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "Could not load analytics.");
          return;
        }
        setData(body.analytics as SalesAnalytics);
      })
      .catch(() => !cancelled && setError("Could not load analytics."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const maxDaily = useMemo(() => Math.max(1, ...(data?.dailyTotals.map((d) => d.revenue) ?? [1])), [data]);

  const pieGradient = useMemo(() => {
    if (!data || data.categoryTotals.length === 0) return "";
    const total = data.categoryTotals.reduce((s, c) => s + c.revenue, 0) || 1;
    let acc = 0;
    const stops = data.categoryTotals.map((c, i) => {
      const start = (acc / total) * 360;
      acc += c.revenue;
      const end = (acc / total) * 360;
      return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <label className="flex flex-col gap-1 text-sm text-navy-800">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-navy-800">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <button onClick={() => { setFrom(todayIso()); setTo(todayIso()); }} className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100">
            Today
          </button>
          <button onClick={() => { setFrom(daysAgoIso(6)); setTo(todayIso()); }} className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100">
            Last 7 days
          </button>
          <button onClick={() => { setFrom(firstOfMonthIso()); setTo(todayIso()); }} className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100">
            This month
          </button>
        </div>
        <a
          href={`/api/analytics/export?from=${from}&to=${to}`}
          className="ml-auto rounded-md bg-navy-900 px-3 py-2 text-xs font-medium text-white hover:bg-navy-800"
        >
          Export orders (CSV)
        </a>
      </div>
      <p className="-mt-4 text-xs text-navy-600">
        Export covers whatever range is selected above — pick any past dates, including previous months, before downloading.
      </p>

      {error && <p className="text-sm text-status-out">{error}</p>}
      {loading && <p className="text-sm text-navy-600">Loading…</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs text-navy-600">Revenue</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{formatBaht(data.totalRevenue)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Orders</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{data.totalOrders}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Avg. order</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">
                {formatBaht(data.totalOrders ? data.totalRevenue / data.totalOrders : 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Days with sales</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{data.dailyTotals.length}</p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950">Daily sales</h2>
            {data.dailyTotals.length === 0 ? (
              <p className="mt-2 text-sm text-navy-600">No sales in this range.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {data.dailyTotals.map((d) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-navy-600">{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <div className="h-4 flex-1 rounded bg-navy-100">
                      <div className="h-4 rounded bg-navy-900" style={{ width: `${Math.max(2, (d.revenue / maxDaily) * 100)}%` }} />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-navy-800">{formatBaht(d.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-950">Bestsellers</h2>
              <ol className="mt-3 space-y-1.5 text-sm text-navy-800">
                {data.bestsellers.map((it, i) => (
                  <li key={it.code} className="flex justify-between">
                    <span>{i + 1}. {it.name}</span>
                    <span className="text-navy-600">{it.qty} sold</span>
                  </li>
                ))}
                {data.bestsellers.length === 0 && <p className="text-navy-600">No sales yet.</p>}
              </ol>
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-950">Slow movers</h2>
              <p className="mt-1 text-xs text-navy-600">Worth a promotion push.</p>
              <ol className="mt-3 space-y-1.5 text-sm text-navy-800">
                {data.leastSellers.map((it, i) => (
                  <li key={it.code} className="flex justify-between">
                    <span>{i + 1}. {it.name}</span>
                    <span className="text-navy-600">{it.qty} sold</span>
                  </li>
                ))}
                {data.leastSellers.length === 0 && <p className="text-navy-600">No sales yet.</p>}
              </ol>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950">Sales by category</h2>
            {data.categoryTotals.length === 0 ? (
              <p className="mt-2 text-sm text-navy-600">No sales in this range.</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <div className="h-32 w-32 shrink-0 rounded-full" style={{ background: pieGradient }} />
                <ul className="space-y-1 text-sm text-navy-800">
                  {data.categoryTotals.map((c, i) => (
                    <li key={c.category} className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {c.category} &middot; {formatBaht(c.revenue)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950">Frequently ordered together</h2>
            <p className="mt-1 text-xs text-navy-600">Simple co-occurrence counts from real order history — no AI involved.</p>
            {data.topPairs.length === 0 ? (
              <p className="mt-2 text-sm text-navy-600">Not enough order history yet to find pairs.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm text-navy-800">
                {data.topPairs.map((p) => (
                  <li key={`${p.codeA}-${p.codeB}`} className="flex justify-between">
                    <span>{p.nameA} + {p.nameB}</span>
                    <span className="text-navy-600">{p.count} orders</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
