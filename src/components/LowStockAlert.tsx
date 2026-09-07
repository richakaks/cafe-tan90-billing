"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 20000;
const STORAGE_KEY = "tan90_lowstock_ack_ids";
// Per-tab (not per-browser) flag: set the first time this component shows
// the alert after this tab was opened, so it always pops "first thing after
// log in" (staff open a fresh tab to log in) even if every item in it was
// already acknowledged on a previous visit -- separate from STORAGE_KEY's
// longer-lived "don't re-alert for the same still-low item" tracking, which
// keeps governing every alert *after* this first one this session.
const SESSION_SHOWN_KEY = "tan90_lowstock_shown_this_session";

type Alert = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  status: "out_of_stock" | "low_stock";
};

function readAcknowledged(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeAcknowledged(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // best-effort — a private window or blocked storage just means it'll re-alert next poll
  }
}

// Staff-wide popup: polls for ingredients that are currently low/out, and
// pops up an "OK to dismiss" alert whenever one wasn't already acknowledged.
// Acknowledging an item is remembered per-browser (localStorage) so it stays
// quiet until either a *new* item goes low, or a previously-acknowledged item
// recovers above threshold and later dips low again (it's dropped from the
// acknowledged set the moment it's no longer in the alert list, so it's
// treated as "new" if it happens again).
export default function LowStockAlert() {
  const [visible, setVisible] = useState<Alert[]>([]);
  const shownThisSession = useRef(false);

  useEffect(() => {
    try {
      shownThisSession.current = window.sessionStorage.getItem(SESSION_SHOWN_KEY) === "1";
    } catch {
      // private window / blocked storage — treat as "not shown yet", same as a fresh tab
    }

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/ingredients/alerts", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = await res.json();
        const alerts = (body.alerts ?? []) as Alert[];
        const currentIds = new Set(alerts.map((a) => a.id));

        const acknowledged = readAcknowledged();
        // Drop anything no longer in the alert list — if it dips low again
        // later, it should alert again rather than staying silenced forever.
        const pruned = new Set(Array.from(acknowledged).filter((id) => currentIds.has(id)));

        // The very first check this tab makes always pops the alert if
        // anything is low/out — right after logging in, staff should see
        // today's stock situation up front, even if every item in it was
        // already acknowledged on an earlier visit.
        const isFirstCheckThisSession = !shownThisSession.current;
        const hasNewAlert = alerts.some((a) => !pruned.has(a.id));
        if (alerts.length > 0 && (isFirstCheckThisSession || hasNewAlert)) {
          // Show the full current list for context, not just the new item(s).
          setVisible(alerts);
        }
        if (isFirstCheckThisSession) {
          shownThisSession.current = true;
          try {
            window.sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
          } catch {
            // best-effort — worst case it just re-shows on the next poll too
          }
        }
        writeAcknowledged(pruned);
      } catch {
        // silent — next poll will retry
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function dismiss() {
    writeAcknowledged(new Set(visible.map((a) => a.id)));
    setVisible([]);
  }

  if (visible.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 px-4">
      <div className="card w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-status-out">Stock alert</p>
        <h2 className="mt-1 text-lg font-semibold text-navy-950">
          {visible.length} item{visible.length === 1 ? " is" : "s are"} low or out of stock
        </h2>
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
          {visible.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3">
              <span className="text-navy-900">{a.name}</span>
              <span className={a.status === "out_of_stock" ? "text-status-out" : "text-status-low"}>
                {a.status === "out_of_stock" ? "Out" : `${a.currentStock} ${a.unit} left`}
              </span>
            </li>
          ))}
        </ul>
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800"
        >
          OK
        </button>
        <Link
          href="/admin/inventory"
          onClick={dismiss}
          className="mt-2 block w-full rounded-lg border border-card-border px-4 py-2.5 text-center text-sm font-medium text-navy-900 transition hover:bg-navy-100"
        >
          Go to inventory
        </Link>
      </div>
    </div>
  );
}
