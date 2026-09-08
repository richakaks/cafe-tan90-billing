"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesAnalytics } from "@/lib/types";
import { RangeResetOrdersButton, ResetButton } from "@/components/OrdersDangerZone";

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Pure calendar-date helpers, Asia/Bangkok for anything anchored to "today"
// (Today/This month jump targets), otherwise plain UTC date-string math —
// these are just calendar labels, not instants, so UTC increments avoid any
// DST surprise without needing a timezone-aware library.
// ---------------------------------------------------------------------------
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function monthOf(iso: string): string {
  return iso.slice(0, 7);
}
function firstOfMonth(monthIso: string): string {
  return `${monthIso}-01`;
}
function lastOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function addMonths(monthIso: string, n: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(monthIso: string): string {
  return new Date(`${monthIso}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const PIE_COLORS = ["#101a3d", "#2c3f85", "#d9a441", "#1c8a4c", "#b8790f", "#b3372c", "#6b7db0", "#8a6d3b"];

type ViewMode = "day" | "month" | "custom";

// Small up/down badge comparing the current period's number to the same
// number for the immediately preceding period of equal length. Null previous
// value with a nonzero current one reads as "New" (nothing to compare
// against, e.g. the very first tracked period); both zero renders nothing.
// Rendered as its own line below the card's number (not inline right after
// it) so it can never overflow/clip past the card edge on a narrow 2-column
// grid -- that clipping is what made it look like a stray floating circle.
function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return (
      <span className="mt-1 inline-block rounded-full bg-status-good/15 px-1.5 py-0.5 text-[10px] font-medium text-status-good">
        New
      </span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const flat = Math.abs(pct) < 0.5;
  const positive = pct >= 0;
  return (
    <span
      className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        flat ? "bg-navy-100 text-navy-600" : positive ? "bg-status-good/15 text-status-good" : "bg-status-out/15 text-status-out"
      }`}
      title="vs. the same-length period right before this one"
    >
      {flat ? "±0%" : `${positive ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`}
    </span>
  );
}

export default function AnalyticsClient() {
  const [mode, setMode] = useState<ViewMode>("month");
  const [day, setDay] = useState(todayIso());
  const [month, setMonth] = useState(monthOf(todayIso()));
  const [customFrom, setCustomFrom] = useState(monthOf(todayIso()) + "-01");
  const [customTo, setCustomTo] = useState(todayIso());

  const from = mode === "day" ? day : mode === "month" ? firstOfMonth(month) : customFrom;
  const to = mode === "day" ? day : mode === "month" ? lastOfMonth(month) : customTo;

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
  const maxHourly = useMemo(() => Math.max(1, ...(data?.hourlyTotals.map((h) => h.revenue) ?? [1])), [data]);
  const daysWithSales = useMemo(() => data?.dailyTotals.filter((d) => d.revenue > 0).length ?? 0, [data]);
  const hasAnySales = useMemo(() => (data?.dailyTotals.some((d) => d.revenue > 0) ?? false), [data]);
  const hasLiveHourlyData = useMemo(() => (data?.hourlyTotals.some((h) => h.orderCount > 0) ?? false), [data]);
  // Percentages are of cash+online only (so the two shown figures sum to
  // 100%) — "not yet recorded" orders are shown separately as a raw amount,
  // not folded into that percentage.
  const paidSplitTotal = useMemo(
    () => (data ? data.paymentSplit.cash + data.paymentSplit.online : 0),
    [data]
  );
  const sortedWeekdays = useMemo(
    () => (data ? [...data.weekdayTotals].sort((a, b) => b.revenue - a.revenue) : []),
    [data]
  );

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

  const tabs: { key: ViewMode; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "month", label: "Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-8">
      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-md border border-card-border p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  mode === t.key ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-navy-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <a
            href={`/api/analytics/export?from=${from}&to=${to}`}
            className="rounded-md bg-navy-900 px-3 py-2 text-xs font-medium text-white hover:bg-navy-800"
          >
            Export orders (CSV)
          </a>
        </div>

        {mode === "day" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDay((d) => addDaysIso(d, -1))}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
            >
              &larr; Prev day
            </button>
            <input
              type="date"
              value={day}
              max={todayIso()}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="rounded-md border border-card-border px-3 py-2 text-sm"
            />
            <button
              onClick={() => setDay((d) => addDaysIso(d, 1))}
              disabled={day >= todayIso()}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next day &rarr;
            </button>
            <button
              onClick={() => setDay(todayIso())}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
            >
              Today
            </button>
            <span className="text-xs text-navy-600">{dayLabel(day)}</span>
          </div>
        )}

        {mode === "month" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
            >
              &larr; Prev month
            </button>
            <span className="min-w-[9rem] text-center text-sm font-medium text-navy-950">{monthLabel(month)}</span>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              disabled={month >= monthOf(todayIso())}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next month &rarr;
            </button>
            <button
              onClick={() => setMonth(monthOf(todayIso()))}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
            >
              This month
            </button>
          </div>
        )}

        {mode === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-navy-800">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-card-border px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-navy-800">
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-card-border px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={() => {
                setCustomFrom(addDaysIso(todayIso(), -6));
                setCustomTo(todayIso());
              }}
              className="rounded-md border border-card-border px-3 py-2 text-xs font-medium text-navy-900 hover:bg-navy-100"
            >
              Last 7 days
            </button>
          </div>
        )}
      </div>
      <p className="-mt-4 text-xs text-navy-600">
        Export covers whatever range is selected above — pick any past dates, including previous months, before downloading.
      </p>

      {error && <p className="text-sm text-status-out">{error}</p>}
      {loading && <p className="text-sm text-navy-600">Loading…</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="card p-4">
              <p className="text-xs text-navy-600">Revenue</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{formatBaht(data.totalRevenue)}</p>
              <TrendBadge current={data.totalRevenue} previous={data.previousPeriod.revenue} />
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Profit (est.)</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{formatBaht(data.profit.estimated)}</p>
              {data.profit.excludedLineItems > 0 && (
                <p className="mt-0.5 text-[11px] leading-tight text-navy-500">
                  Excludes {data.profit.excludedLineItems} line item{data.profit.excludedLineItems === 1 ? "" : "s"} (
                  {formatBaht(data.profit.excludedRevenue)} revenue) with no costing-table price on file
                </p>
              )}
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Orders</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{data.totalOrders}</p>
              <TrendBadge current={data.totalOrders} previous={data.previousPeriod.orders} />
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Avg. order</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">
                {formatBaht(data.totalOrders ? data.totalRevenue / data.totalOrders : 0)}
              </p>
              <TrendBadge
                current={data.totalOrders ? data.totalRevenue / data.totalOrders : 0}
                previous={data.previousPeriod.orders ? data.previousPeriod.revenue / data.previousPeriod.orders : 0}
              />
            </div>
            <div className="card p-4">
              <p className="text-xs text-navy-600">Days with sales</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{daysWithSales}</p>
            </div>
          </div>
          {data.historicalRevenue > 0 && (
            <p className="-mt-4 text-xs text-navy-600">
              Includes {formatBaht(data.historicalRevenue)} from imported historical sales (before online ordering
              started) — those don&apos;t have per-order data, so Orders, Avg. order, and the trend badges above
              only count real orders placed through the app (Profit and Revenue both include historical sales).
            </p>
          )}
          <p className="-mt-4 text-xs text-navy-600">
            Profit is an estimate: revenue (live orders + historical sales) minus cost of goods, using each
            item&apos;s cost from the Tan90 Costing Table. Trend badges compare this period to the same-length
            period right before it.
          </p>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950">Daily sales</h2>
            {!hasAnySales ? (
              <p className="mt-2 text-sm text-navy-600">No sales in this range.</p>
            ) : (
              <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
                {data.dailyTotals.map((d) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-navy-600">
                      {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    <div className="h-4 flex-1 rounded bg-navy-100">
                      <div className="h-4 rounded bg-navy-900" style={{ width: `${d.revenue > 0 ? Math.max(2, (d.revenue / maxDaily) * 100) : 0}%` }} />
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
                  <li key={it.code} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {it.name}
                      {it.offMenu && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          no longer on menu
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-navy-600">{it.qty} sold</span>
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
                  <li key={it.code} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {it.name}
                      {it.offMenu && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          no longer on menu
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-navy-600">{it.qty} sold</span>
                  </li>
                ))}
                {data.leastSellers.length === 0 && <p className="text-navy-600">No sales yet.</p>}
              </ol>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              <h2 className="text-sm font-semibold text-navy-950">Best day of the week</h2>
              <p className="mt-1 text-xs text-navy-600">Revenue by weekday within this range, with a fair per-occurrence average.</p>
              {data.weekdayTotals.every((w) => w.revenue === 0) ? (
                <p className="mt-2 text-sm text-navy-600">No sales in this range.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm text-navy-800">
                  {sortedWeekdays.map((w) => (
                    <li key={w.weekday} className="flex justify-between gap-3">
                      <span>{w.label}</span>
                      <span className="text-navy-600">
                        {formatBaht(w.revenue)}
                        {w.occurrences > 0 && <span className="text-navy-400"> &middot; avg {formatBaht(w.revenue / w.occurrences)}/day</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-950">Peak ordering hours</h2>
              <p className="mt-1 text-xs text-navy-600">
                Live orders only, Bangkok time — the imported historical log has no time-of-day data to include here.
              </p>
              {!hasLiveHourlyData ? (
                <p className="mt-2 text-sm text-navy-600">No live app orders in this range yet.</p>
              ) : (
                <div className="mt-4 flex h-28 items-end gap-0.5">
                  {data.hourlyTotals.map((h) => (
                    <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end" title={`${h.hour}:00 — ${formatBaht(h.revenue)}, ${h.orderCount} orders`}>
                      <div
                        className="w-full rounded-t bg-navy-900"
                        style={{ height: `${h.revenue > 0 ? Math.max(3, (h.revenue / maxHourly) * 100) : 0}%` }}
                      />
                      {h.hour % 3 === 0 && <span className="mt-1 text-[9px] text-navy-500">{h.hour}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-950">Coupons &amp; discounts</h2>
              <p className="mt-1 text-xs text-navy-600">Within this range.</p>
              <ul className="mt-3 space-y-1.5 text-sm text-navy-800">
                <li className="flex justify-between">
                  <span>Discount given on bills</span>
                  <span className="text-navy-600">{formatBaht(data.couponSummary.discountGiven)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Coupons redeemed</span>
                  <span className="text-navy-600">
                    {data.couponSummary.redeemedCount} &middot; {formatBaht(data.couponSummary.redeemedValue)}
                  </span>
                </li>
              </ul>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-950">Payment method</h2>
              <p className="mt-1 text-xs text-navy-600">Live orders, recorded when a bill is marked paid.</p>
              {data.paymentSplit.cashOrders + data.paymentSplit.onlineOrders + data.paymentSplit.unknownOrders === 0 ? (
                <p className="mt-2 text-sm text-navy-600">No orders in this range yet.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm text-navy-800">
                  <li className="flex justify-between">
                    <span>💵 Cash</span>
                    <span className="text-navy-600">
                      {formatBaht(data.paymentSplit.cash)} &middot; {pct(data.paymentSplit.cash, paidSplitTotal)}%
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>💳 Online</span>
                    <span className="text-navy-600">
                      {formatBaht(data.paymentSplit.online)} &middot; {pct(data.paymentSplit.online, paidSplitTotal)}%
                    </span>
                  </li>
                  {data.paymentSplit.unknownOrders > 0 && (
                    <li className="flex justify-between text-navy-500">
                      <span>Not yet recorded</span>
                      <span>
                        {formatBaht(data.paymentSplit.unknown)} &middot; {data.paymentSplit.unknownOrders} order
                        {data.paymentSplit.unknownOrders === 1 ? "" : "s"}
                      </span>
                    </li>
                  )}
                </ul>
              )}
              {data.historicalCashNote.count > 0 && (
                <p className="mt-3 text-xs text-navy-500">
                  Separately, the imported historical spreadsheet notes {data.historicalCashNote.count} sale line
                  {data.historicalCashNote.count === 1 ? "" : "s"} ({formatBaht(data.historicalCashNote.revenue)}) as
                  Cash — that source never recorded &quot;Online&quot;, so this isn&apos;t folded into the split
                  above.
                </p>
              )}
            </div>
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

      <div className="card border-status-out/40 p-5">
        <h2 className="text-sm font-semibold text-status-out">Danger zone</h2>
        <p className="mt-1 text-xs text-navy-600">
          Testing/setup tools for clearing trial orders — this is what the Daily Sales numbers above are computed
          from, so deleting orders resets what shows here too. Also available on the Inventory admin page. Neither
          of these touches ingredient stock levels.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ResetButton
            label="Reset all orders"
            confirmLabel="Yes, delete all orders"
            warning="This permanently deletes every order (open, served, and paid) and frees up any coupon codes they'd redeemed. It does not touch ingredient stock levels. To only clear some dates instead of everything, use “Reset orders in a date range” below."
            endpoint="/api/admin/reset-orders"
          />
          <RangeResetOrdersButton />
        </div>
      </div>
    </div>
  );
}
