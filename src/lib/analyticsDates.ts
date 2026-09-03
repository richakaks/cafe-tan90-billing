// Pure calendar-date helpers used by getSalesAnalytics (src/lib/data.ts) for
// zero-filling the daily chart, weekday grouping, and the "previous period"
// comparison. Kept in their own module (rather than inline in data.ts, which
// pulls in the Supabase client and can't be unit-tested standalone) so they
// have direct vitest coverage — see analyticsDates.test.ts.
//
// Everything here operates on plain "YYYY-MM-DD" strings and increments in
// UTC purely to avoid any DST edge case; Thailand doesn't observe DST, but
// this also keeps the math correct if this ever runs somewhere that does —
// these are calendar dates, not instants, so there's no reason to let local
// server time anywhere near them.

export function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDateOnly(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDateOnly(d);
}

export function daysBetweenInclusive(from: string, to: string): number {
  const ms = parseDateOnly(to).getTime() - parseDateOnly(from).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function weekdayOf(iso: string): number {
  return parseDateOnly(iso).getUTCDay();
}

// Every date from `from` to `to` inclusive. Capped at 366 days — a longer
// custom range still computes correct totals in getSalesAnalytics, just
// falls back there to only the dates that actually have data rather than
// rendering (and holding in memory) a year-plus of mostly-empty daily
// entries. Returns [] both for an invalid/empty range and for one over the
// cap, so callers should treat an empty result as "don't zero-fill."
export function enumerateDates(from: string, to: string): string[] {
  const n = daysBetweenInclusive(from, to);
  if (n <= 0 || n > 366) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(from, i));
  return out;
}
