"use client";

import { useEffect, useState } from "react";
import type { CashDay, FlaggedCashDay, StaffMember } from "@/lib/types";

function baht(n: number | null): string {
  if (n === null) return "—";
  return `฿${(Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function openingText(d: CashDay): string {
  return d.opening !== null ? String(d.opening) : d.suggestedOpening !== null ? String(d.suggestedOpening) : "";
}

type Recent = { day: string; opening: number | null; closingCounted: number | null; flagStatus: string | null; difference: number | null }[];

export default function CashClient({
  initialDay,
  initialRecent,
  initialFlagged,
  today,
  staff,
}: {
  initialDay: CashDay;
  initialRecent: Recent;
  initialFlagged: FlaggedCashDay[];
  today: string;
  staff: StaffMember[];
}) {
  const [day, setDay] = useState(initialDay);
  const [flagged, setFlagged] = useState(initialFlagged);
  const [reason, setReason] = useState("");
  const [recent, setRecent] = useState(initialRecent);
  const [opening, setOpening] = useState(openingText(initialDay));
  const [closing, setClosing] = useState(initialDay.closingCounted !== null ? String(initialDay.closingCounted) : "");
  const [note, setNote] = useState(initialDay.note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
      setStaffId(window.localStorage.getItem("tan90_counter_staff_v1"));
    } catch {
      // ignore
    }
  }, []);

  function showDay(d: CashDay) {
    setDay(d);
    setOpening(openingText(d));
    setClosing(d.closingCounted !== null ? String(d.closingCounted) : "");
    setNote(d.note ?? "");
  }

  async function load(date: string) {
    setMsg(null);
    try {
      const res = await fetch(`/api/cash?date=${date}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showDay(data.day);
      setRecent(data.recent);
      if (data.flagged) setFlagged(data.flagged);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "No connection.");
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day.day, opening, closingCounted: closing, note, staffId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showDay(data.day);
      if (data.flagged) setFlagged(data.flagged);
      setMsg(data.day?.flagStatus === "flagged" ? "Saved — the difference is flagged until someone resolves it." : "Saved.");
      load(day.day);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Could not save — check the connection.");
    } finally {
      setBusy(false);
    }
  }

  // Live preview while typing, before saving.
  const openNum = opening === "" ? null : Number(opening);
  const closeNum = closing === "" ? null : Number(closing);
  const expected = openNum === null ? null : Math.round((openNum + day.cashHandedOver - day.changeGiven - day.cashRefunded - day.cashPurchases) * 100) / 100;

  async function resolve() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cash/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day.day, reason, staffId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showDay(data.day);
      setFlagged(data.flagged);
      setReason("");
      setMsg("Marked resolved.");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Could not save — check the connection.");
    } finally {
      setBusy(false);
    }
  }
  const diff = expected === null || closeNum === null ? null : Math.round((closeNum - expected) * 100) / 100;
  const input = "w-full rounded-md border border-card-border px-3 py-2 text-base";
  const staffName = staff.find((s) => s.id === staffId)?.name;

  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <div className="card space-y-2 border-2 border-status-out p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-status-out">⚑ Drawer differences to resolve ({flagged.length})</h2>
          <ul className="space-y-1 text-sm">
            {flagged.map((f) => (
              <li key={f.day}>
                <button type="button" onClick={() => load(f.day)} className="flex w-full justify-between rounded-md px-2 py-1 text-left hover:bg-red-50">
                  <span className="underline">{f.day}</span>
                  <span className="font-semibold text-status-out">
                    {f.difference > 0 ? `+${baht(f.difference)} over` : `${baht(-f.difference)} short`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => load(addDays(day.day, -1))} className="rounded-md border border-card-border px-3 py-2 text-sm">
          ‹
        </button>
        <input type="date" value={day.day} onChange={(e) => e.target.value && load(e.target.value)} className="rounded-md border border-card-border px-3 py-2 text-sm" />
        <button type="button" onClick={() => load(addDays(day.day, 1))} className="rounded-md border border-card-border px-3 py-2 text-sm">
          ›
        </button>
        {day.day !== today && (
          <button type="button" onClick={() => load(today)} className="text-xs text-navy-700 underline">
            Today
          </button>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <label className="block text-sm font-medium text-navy-900">
          Opening balance (counted at opening)
          <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} className={`${input} mt-1`} placeholder="฿" />
          {day.opening === null && day.suggestedOpening !== null && (
            <span className="mt-1 block text-xs font-normal text-navy-600">Filled in from the last counted closing ({baht(day.suggestedOpening)}). Change it if the count differs.</span>
          )}
        </label>

        <div className="space-y-1 rounded-lg bg-navy-100/60 p-4 text-sm">
          <div className="flex justify-between"><span>Opening</span><span>{baht(openNum)}</span></div>
          <div className="flex justify-between"><span>+ Cash handed over by customers</span><span>{baht(day.cashHandedOver)}</span></div>
          <div className="flex justify-between"><span>− Change given back</span><span>{baht(day.changeGiven)}</span></div>
          <div className="flex justify-between"><span>− Cash refunds</span><span>{baht(day.cashRefunded)}</span></div>
          <div className="flex justify-between"><span>− Purchases / pay-backs from the drawer <a href="/purchases" className="text-[11px] text-navy-700 underline">see Purchases</a></span><span>{baht(day.cashPurchases)}</span></div>
          <div className="flex justify-between border-t border-card-border pt-1 font-semibold"><span>Suggested closing</span><span>{baht(expected)}</span></div>
          <p className="text-[11px] text-navy-600">Only cash counts here — online and coupon payments never go in the drawer.</p>
        </div>

        <label className="block text-sm font-medium text-navy-900">
          Closing balance (counted at closing)
          <input inputMode="decimal" value={closing} onChange={(e) => setClosing(e.target.value)} className={`${input} mt-1`} placeholder="฿" />
        </label>

        {diff !== null && (
          <p className={`rounded-lg p-3 text-sm font-semibold ${Math.abs(diff) < 0.005 ? "bg-navy-100 text-status-good" : "bg-red-50 text-status-out"}`}>
            {Math.abs(diff) < 0.005 ? "Drawer matches the suggestion ✓" : diff > 0 ? `Drawer has ${baht(diff)} MORE than suggested` : `Drawer is ${baht(-diff)} SHORT of the suggestion`}
          </p>
        )}

        {day.flagStatus === "flagged" && (
          <div className="space-y-2 rounded-lg border-2 border-status-out bg-red-50 p-3">
            <p className="text-sm font-semibold text-status-out">
              ⚑ Flagged: counted {baht(day.closingCounted)} vs suggested {baht(day.savedExpected)} ({day.savedDifference !== null && day.savedDifference > 0 ? "+" : ""}
              {baht(day.savedDifference)}). It stays flagged until resolved.
            </p>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={input} placeholder="Reason (e.g. ฿100 given as change twice, owner took ฿500)" />
            <button type="button" disabled={busy || !reason.trim()} onClick={resolve} className="w-full rounded-lg bg-status-out px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Mark resolved
            </button>
          </div>
        )}
        {day.flagStatus === "resolved" && (
          <p className="rounded-lg bg-navy-100 p-3 text-sm text-navy-800">
            <span className="font-semibold">Resolved</span> ({baht(day.savedDifference)} difference): {day.resolvedReason}
            <span className="block text-xs text-navy-600">
              {day.resolvedByName ? `by ${day.resolvedByName} · ` : ""}
              {day.resolvedAt ? new Date(day.resolvedAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }) : ""}
            </span>
          </p>
        )}

        <label className="block text-sm font-medium text-navy-900">
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className={`${input} mt-1`} placeholder="e.g. took ฿200 out for change" />
        </label>

        <button type="button" disabled={busy} onClick={save} className="w-full rounded-lg bg-navy-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        {staffName && <p className="text-center text-[11px] text-navy-600">Saved as {staffName}</p>}
        {msg && <p className="text-sm text-navy-700">{msg}</p>}
      </div>

      {recent.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-600">Recent days</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-navy-600">
                <th className="py-1">Day</th>
                <th className="py-1 text-right">Opening</th>
                <th className="py-1 text-right">Closing</th>
                <th className="py-1 text-right">Check</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.day} className="cursor-pointer border-t border-card-border hover:bg-navy-100/50" onClick={() => load(r.day)}>
                  <td className="py-1.5">{r.day}</td>
                  <td className="py-1.5 text-right">{baht(r.opening)}</td>
                  <td className="py-1.5 text-right">{baht(r.closingCounted)}</td>
                  <td className="py-1.5 text-right text-xs">
                    {r.flagStatus === "ok" ? (
                      <span className="text-status-good">✓ matched</span>
                    ) : r.flagStatus === "flagged" ? (
                      <span className="font-semibold text-status-out">⚑ {baht(r.difference)}</span>
                    ) : r.flagStatus === "resolved" ? (
                      <span className="text-navy-600">resolved</span>
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
