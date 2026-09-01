"use client";

import { useEffect, useState } from "react";

const POLL_MS = 20000;
const STORAGE_KEY = "tan90_lowstock_ack_ids";

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

  useEffect(() => {
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

        const hasNewAlert = alerts.some((a) => !pruned.has(a.id));
        if (hasNewAlert) {
          // Show the full current list for context, not just the new item(s).
          setVisible(alerts);
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
      </div>
    </div>
  );
}
