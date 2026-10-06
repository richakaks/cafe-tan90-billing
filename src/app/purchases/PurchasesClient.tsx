"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Purchase, PurchasePaidVia, StaffMember } from "@/lib/types";

type Suggestions = { items: string[]; brands: string[]; units: string[]; payers: string[] };

const VIA: { value: PurchasePaidVia; label: string; hint: string }[] = [
  { value: "drawer", label: "Cash (drawer)", hint: "taken from the till" },
  { value: "online", label: "Online", hint: "transfer / card" },
  { value: "own_pocket", label: "Own pocket", hint: "someone paid with their own money" },
];
const VIA_SHORT: Record<PurchasePaidVia, string> = { drawer: "Cash (drawer)", online: "Online", own_pocket: "Own pocket" };

function baht(n: number): string {
  return `฿${(Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthBounds(date: string): { from: string; to: string } {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
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

type Line = { item: string; brand: string; quantity: string; unit: string; price: string };
const emptyLine = (): Line => ({ item: "", brand: "", quantity: "", unit: "", price: "" });

const input = "w-full rounded-md border border-card-border bg-white px-2.5 py-2 text-sm";

function ViaPicker({ value, onChange }: { value: PurchasePaidVia; onChange: (v: PurchasePaidVia) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {VIA.map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => onChange(v.value)}
          className={`rounded-lg px-2 py-2 text-sm font-medium ${value === v.value ? "bg-navy-900 text-white" : "border border-card-border bg-white text-navy-900"}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function PurchaseRow({ p, onChanged }: { p: Purchase; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    purchaseDate: p.purchaseDate,
    item: p.item,
    brand: p.brand ?? "",
    quantity: p.quantity === null ? "" : String(p.quantity),
    unit: p.unit ?? "",
    price: String(p.price),
    paidVia: p.paidVia,
    paidBy: p.paidBy ?? "",
    note: p.note ?? "",
  });

  async function save() {
    if (f.paidVia === "own_pocket" && !f.paidBy.trim()) {
      setError("Who paid from their own pocket?");
      return;
    }
    setBusy(true);
    const err = await send(`/api/purchases/${p.id}`, "PATCH", f);
    setBusy(false);
    if (err) return setError(err);
    setEditing(false);
    setError(null);
    onChanged();
  }

  if (!editing) {
    return (
      <li className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy-950">
            {p.item}
            {p.brand && <span className="font-normal text-navy-600"> · {p.brand}</span>}
          </p>
          <p className="text-xs text-navy-600">
            {p.quantity !== null ? `${p.quantity} ${p.unit ?? ""} · ` : p.unit ? `${p.unit} · ` : ""}
            {VIA_SHORT[p.paidVia]}
            {p.paidBy ? ` · paid by ${p.paidBy}` : ""}
            {p.paidVia === "own_pocket" && (p.reimbursedOn ? ` · paid back ${p.reimbursedOn}` : " · not paid back yet")}
            {p.note ? ` · ${p.note}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-semibold text-navy-950">{baht(p.price)}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-navy-700 underline">
            Edit
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-lg bg-navy-100/60 p-3 my-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <label className="col-span-2 text-xs text-navy-700 sm:col-span-2">
          Item
          <input list="pt-items" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} className={input} />
        </label>
        <label className="text-xs text-navy-700 sm:col-span-2">
          Brand
          <input list="pt-brands" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className={input} />
        </label>
        <label className="text-xs text-navy-700">
          Date
          <input type="date" value={f.purchaseDate} onChange={(e) => setF({ ...f, purchaseDate: e.target.value })} className={input} />
        </label>
        <label className="text-xs text-navy-700">
          Price ฿
          <input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={input} />
        </label>
        <label className="text-xs text-navy-700">
          Amount
          <input inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} className={input} />
        </label>
        <label className="text-xs text-navy-700">
          Unit
          <input list="pt-units" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={input} />
        </label>
        <label className="col-span-2 text-xs text-navy-700 sm:col-span-2">
          Who paid
          <input list="pt-payers" value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })} className={input} />
        </label>
        <label className="col-span-2 text-xs text-navy-700 sm:col-span-2">
          Note
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={input} />
        </label>
      </div>
      <ViaPicker value={f.paidVia} onChange={(v) => setF({ ...f, paidVia: v })} />
      {error && <p className="text-xs text-status-out">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-card-border px-3 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Delete "${p.item}" (${baht(p.price)})?`)) return;
            setBusy(true);
            const err = await send(`/api/purchases/${p.id}`, "DELETE");
            setBusy(false);
            if (err) return setError(err);
            onChanged();
          }}
          className="ml-auto rounded-md px-3 py-2 text-sm text-status-out underline"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function OwedRow({ p, today, onChanged }: { p: Purchase; today: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [via, setVia] = useState<"drawer" | "online">("drawer");
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{p.item}</span> <span className="text-xs text-navy-600">· {p.purchaseDate}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-semibold">{baht(p.price)}</span>
          <button type="button" onClick={() => setOpen(!open)} className="text-xs text-navy-700 underline">
            Paid back
          </button>
        </span>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-navy-100/60 p-2 text-xs">
          <span>Paid back on</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-card-border px-2 py-1" />
          <span>from</span>
          <select value={via} onChange={(e) => setVia(e.target.value as "drawer" | "online")} className="rounded-md border border-card-border px-2 py-1">
            <option value="drawer">the cash drawer</option>
            <option value="online">online transfer</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              const err = await send(`/api/purchases/${p.id}`, "PATCH", { reimbursedOn: date, reimbursedVia: via });
              if (err) return setError(err);
              onChanged();
            }}
            className="rounded-md bg-navy-900 px-3 py-1.5 font-medium text-white"
          >
            Save
          </button>
          {error && <span className="text-status-out">{error}</span>}
        </div>
      )}
    </li>
  );
}

export default function PurchasesClient({ today, staff }: { today: string; staff: StaffMember[] }) {
  const [date, setDate] = useState(today);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [owedBack, setOwedBack] = useState<Purchase[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions>({ items: [], brands: [], units: [], payers: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [addDate, setAddDate] = useState(today);
  const [paidVia, setPaidVia] = useState<PurchasePaidVia>("drawer");
  const [paidBy, setPaidBy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases?from=${d}&to=${d}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPurchases(data.purchases);
      setOwedBack(data.owedBack);
      setSuggestions(data.suggestions);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : "Could not load — check the connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load + remembered staff name (browser storage)
    load(today);
    try {
      setStaffId(window.localStorage.getItem("tan90_counter_staff_v1"));
    } catch {
      // ignore
    }
  }, [load, today]);

  const payerSuggestions = useMemo(() => Array.from(new Set([...staff.map((s) => s.name), ...suggestions.payers])), [staff, suggestions.payers]);
  const linesTotal = lines.reduce((s, l) => s + (Number(l.price) || 0), 0);
  const totals = useMemo(() => {
    const t = { drawer: 0, online: 0, own_pocket: 0 };
    for (const p of purchases) t[p.paidVia] += p.price;
    return t;
  }, [purchases]);
  const owedByPerson = useMemo(() => {
    const m = new Map<string, Purchase[]>();
    for (const p of owedBack) {
      const k = p.paidBy ?? "Unknown";
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return Array.from(m.entries());
  }, [owedBack]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function saveAll() {
    setFormError(null);
    setSaved(null);
    const filled = lines.filter((l) => l.item.trim() || l.price.trim());
    if (filled.length === 0) return setFormError("Add at least one item.");
    if (filled.some((l) => !l.item.trim())) return setFormError("Every line needs an item name.");
    if (filled.some((l) => l.price.trim() === "" || Number.isNaN(Number(l.price)))) return setFormError("Every line needs a price.");
    if (paidVia === "own_pocket" && !paidBy.trim()) return setFormError("Who paid from their own pocket?");
    setSaving(true);
    const err = await send("/api/purchases", "POST", {
      staffId,
      rows: filled.map((l) => ({
        purchaseDate: addDate,
        item: l.item,
        brand: l.brand,
        quantity: l.quantity,
        unit: l.unit,
        price: l.price,
        paidVia,
        paidBy,
        note,
      })),
    });
    setSaving(false);
    if (err) return setFormError(err);
    setSaved(`Saved ${filled.length} item${filled.length === 1 ? "" : "s"} (${baht(filled.reduce((s, l) => s + Number(l.price), 0))}).`);
    setLines([emptyLine()]);
    setNote("");
    if (addDate !== date) setDate(addDate);
    load(addDate);
  }

  const month = monthBounds(date);

  return (
    <div className="space-y-6">
      <datalist id="pt-items">{suggestions.items.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="pt-brands">{suggestions.brands.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="pt-units">{suggestions.units.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="pt-payers">{payerSuggestions.map((v) => <option key={v} value={v} />)}</datalist>

      {/* Add */}
      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-950">Add purchases</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-navy-700">
            Date
            <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className={`${input} mt-0.5`} />
          </label>
          <label className="text-xs text-navy-700">
            Who paid {paidVia === "own_pocket" ? "(required)" : "(optional)"}
            <input list="pt-payers" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Name" className={`${input} mt-0.5`} />
          </label>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-navy-700">How was it paid?</span>
          <ViaPicker value={paidVia} onChange={setPaidVia} />
          <p className="text-[11px] text-navy-600">{VIA.find((v) => v.value === paidVia)?.hint}{paidVia === "drawer" ? " — counted against the cash balance" : ""}</p>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 rounded-lg border border-card-border p-2 sm:grid-cols-12 sm:border-0 sm:p-0">
              <input list="pt-items" value={l.item} onChange={(e) => setLine(i, { item: e.target.value })} placeholder="Item" className={`${input} col-span-6 sm:col-span-4`} />
              <input list="pt-brands" value={l.brand} onChange={(e) => setLine(i, { brand: e.target.value })} placeholder="Brand (optional)" className={`${input} col-span-6 sm:col-span-3`} />
              <input inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Amount" className={`${input} col-span-2 sm:col-span-1`} />
              <input list="pt-units" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} placeholder="Unit" className={`${input} col-span-2 sm:col-span-1`} />
              <input inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} placeholder="Price ฿" className={`${input} col-span-2 sm:col-span-2`} />
              <button
                type="button"
                onClick={() => setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((_, j) => j !== i)))}
                className="col-span-6 text-xs text-status-out underline sm:col-span-1"
              >
                remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="text-sm font-medium text-navy-800 underline">
            + Add another item
          </button>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, e.g. Makro trip)" className={input} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border pt-3">
          <span className="text-sm text-navy-700">
            Total of these lines: <span className="font-bold text-navy-950">{baht(linesTotal)}</span>
            <span className="ml-1 text-xs text-navy-600">(check it matches the receipt)</span>
          </span>
          <button type="button" disabled={saving} onClick={saveAll} className="rounded-lg bg-navy-900 px-5 py-3 text-base font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {formError && <p className="text-sm text-status-out">{formError}</p>}
        {saved && <p className="text-sm text-status-good">{saved}</p>}
      </section>

      {/* Day list */}
      <section className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { const d = addDays(date, -1); setDate(d); load(d); }} className="rounded-md border border-card-border px-2.5 py-1.5 text-sm">‹</button>
            <input type="date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); load(e.target.value); } }} className="rounded-md border border-card-border px-2.5 py-1.5 text-sm" />
            <button type="button" onClick={() => { const d = addDays(date, 1); setDate(d); load(d); }} className="rounded-md border border-card-border px-2.5 py-1.5 text-sm">›</button>
            {date !== today && (
              <button type="button" onClick={() => { setDate(today); load(today); }} className="text-xs text-navy-700 underline">Today</button>
            )}
          </div>
          <div className="flex gap-3 text-xs">
            <a href={`/api/purchases/export?from=${date}&to=${date}`} className="font-medium text-navy-800 underline">Export day</a>
            <a href={`/api/purchases/export?from=${month.from}&to=${month.to}`} className="font-medium text-navy-800 underline">Export month</a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Total", totals.drawer + totals.online + totals.own_pocket],
            ["Cash (drawer)", totals.drawer],
            ["Online", totals.online],
            ["Own pocket", totals.own_pocket],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg bg-navy-100/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-600">{label}</p>
              <p className="text-lg font-bold text-navy-950">{baht(value as number)}</p>
            </div>
          ))}
        </div>

        {loadError && <p className="text-sm text-status-out">{loadError}</p>}
        {loading ? (
          <p className="text-sm text-navy-600">Loading…</p>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-navy-600">No purchases on this day.</p>
        ) : (
          <ul className="divide-y divide-card-border">
            {purchases.map((p) => (
              <PurchaseRow key={JSON.stringify(p)} p={p} onChanged={() => load(date)} />
            ))}
          </ul>
        )}
      </section>

      {/* Owed back */}
      {owedByPerson.length > 0 && (
        <section className="card space-y-3 p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-600">Still to pay back (own pocket)</h2>
          {owedByPerson.map(([person, rows]) => (
            <div key={person}>
              <p className="flex justify-between text-sm font-semibold text-navy-950">
                <span>{person}</span>
                <span>{baht(rows.reduce((s, r) => s + r.price, 0))}</span>
              </p>
              <ul className="divide-y divide-card-border pl-2">
                {rows.map((p) => (
                  <OwedRow key={p.id} p={p} today={today} onChanged={() => load(date)} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
