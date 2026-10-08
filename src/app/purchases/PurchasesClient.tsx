"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BackfillRow, IngredientKind, Purchase, PurchaseInventoryMeta, PurchasePaidVia, ShoppingItem, StaffMember } from "@/lib/types";
import { autoFactor, baseUnitFor, compressImage, normUnit, round3 } from "./inventoryLink";

type Suggestions = { items: string[]; brands: string[]; units: string[]; payers: string[] };

const VIA: { value: PurchasePaidVia; label: string; hint: string }[] = [
  { value: "drawer", label: "Cash (drawer)", hint: "taken from the till" },
  { value: "online", label: "Online", hint: "transfer / card" },
  { value: "own_pocket", label: "Own pocket", hint: "someone paid with their own money" },
];
const VIA_SHORT: Record<PurchasePaidVia, string> = { drawer: "Cash (drawer)", online: "Online", own_pocket: "Own pocket" };
const KIND_LABEL: Record<IngredientKind, string> = { raw: "Raw ingredients", batch_prep: "Batch prep", consumable: "Consumables", supply: "Supplies" };
const KIND_ORDER: IngredientKind[] = ["raw", "consumable", "supply", "batch_prep"];

const EMPTY_META: PurchaseInventoryMeta = { switchOn: false, lastStockCount: null, ingredients: [], links: {}, conversions: {} };

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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function send(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { error: null, data };
    return { error: (data.error as string) ?? "Something went wrong.", data };
  } catch {
    return { error: "No connection — try again when you're back online.", data: {} };
  }
}

async function uploadReceipt(file: File, target: { batchId?: string; purchaseId?: number }): Promise<string | null> {
  const blob = await compressImage(file);
  const form = new FormData();
  form.append("file", blob, "receipt.jpg");
  if (target.batchId) form.append("batchId", target.batchId);
  if (target.purchaseId) form.append("purchaseId", String(target.purchaseId));
  try {
    const res = await fetch("/api/purchases/receipt", { method: "POST", body: form });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.error ?? "Could not upload the photo.";
  } catch {
    return "No connection — photo not uploaded.";
  }
}

const input = "w-full rounded-md border border-card-border bg-white px-2.5 py-2 text-sm";

// ---------------------------------------------------------------------------
// Inventory link pieces
// ---------------------------------------------------------------------------

type Link = { ingredientId: string | null; notInventory: boolean; factor: string; stockQtyOverride?: string };

function InventoryPicker({
  meta,
  link,
  onPick,
  onAddNew,
}: {
  meta: PurchaseInventoryMeta;
  link: Link;
  onPick: (ingredientId: string | null, notInventory: boolean) => void;
  onAddNew: () => void;
}) {
  const value = link.notInventory ? "__none" : link.ingredientId ?? "";
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__add") return onAddNew();
        if (v === "__none") return onPick(null, true);
        onPick(v || null, false);
      }}
      className={input}
    >
      <option value="">— inventory item? —</option>
      <option value="__none">Not for inventory</option>
      <option value="__add">+ Add to inventory…</option>
      {KIND_ORDER.map((kind) => {
        const list = meta.ingredients.filter((i) => i.kind === kind);
        if (list.length === 0) return null;
        return (
          <optgroup key={kind} label={KIND_LABEL[kind]}>
            {list.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

// Works out how much stock a line adds, in the inventory item's unit.
function stockFor(meta: PurchaseInventoryMeta, link: Link, quantity: string, unit: string): { qty: number | null; ingUnit: string | null; needsFactor: boolean; factor: number | null } {
  const ing = meta.ingredients.find((i) => i.id === link.ingredientId);
  if (!ing || link.notInventory) return { qty: null, ingUnit: null, needsFactor: false, factor: null };
  const q = Number(quantity);
  const auto = autoFactor(unit || ing.unit, ing.unit);
  const learned = meta.conversions[`${ing.id}|${(unit || "").trim().toLowerCase()}`];
  const typed = Number(link.factor);
  const factor = link.factor.trim() !== "" && typed > 0 ? typed : auto ?? learned ?? null;
  if (!(q > 0)) return { qty: null, ingUnit: ing.unit, needsFactor: false, factor };
  if (factor === null) return { qty: null, ingUnit: ing.unit, needsFactor: true, factor: null };
  return { qty: round3(q * factor), ingUnit: ing.unit, needsFactor: auto === null, factor };
}

function LinkDetails({
  meta,
  link,
  quantity,
  unit,
  onFactor,
}: {
  meta: PurchaseInventoryMeta;
  link: Link;
  quantity: string;
  unit: string;
  onFactor: (f: string) => void;
}) {
  const ing = meta.ingredients.find((i) => i.id === link.ingredientId);
  if (link.notInventory) return <p className="text-[11px] text-navy-600">Recorded as a purchase only (not inventory).</p>;
  if (!ing) return null;
  const s = stockFor(meta, link, quantity, unit);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-navy-700">
      {s.needsFactor && (
        <span className="flex items-center gap-1">
          1 {unit || "unit"} =
          <input
            inputMode="decimal"
            value={link.factor}
            placeholder={s.factor ? String(s.factor) : "?"}
            onChange={(e) => onFactor(e.target.value)}
            className="w-16 rounded border border-card-border px-1.5 py-0.5"
          />
          {ing.unit}
        </span>
      )}
      {s.qty !== null ? (
        <span>
          → adds <b>{s.qty} {ing.unit}</b> to {ing.name}
          {meta.switchOn ? "" : " (once the inventory switch is on)"}
        </span>
      ) : !(Number(quantity) > 0) ? (
        <span className="text-status-low">Fill in the amount so stock can be added.</span>
      ) : (
        <span className="text-status-low">How many {ing.unit} is 1 {unit || "unit"}?</span>
      )}
    </div>
  );
}

function AddToInventoryForm({
  defaults,
  onCreated,
  onCancel,
}: {
  defaults: { name: string; unit: string; brand: string };
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaults.name);
  const [kind, setKind] = useState<IngredientKind>("raw");
  const [unit, setUnit] = useState(baseUnitFor(defaults.unit));
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-lg border border-navy-700/30 bg-navy-100/60 p-3">
      <p className="text-xs font-semibold text-navy-900">Add a new inventory item</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 text-xs text-navy-700">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-navy-700">
          Tracked in (unit)
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-navy-700">
          Low-stock level
          <input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="optional" className={input} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {KIND_ORDER.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${kind === k ? "bg-navy-900 text-white" : "border border-card-border bg-white"}`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-status-out">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !name.trim() || !unit.trim()}
          onClick={async () => {
            setBusy(true);
            const { error: err, data } = await send("/api/inventory", "POST", {
              name: name.trim(),
              unit: unit.trim(),
              currentStock: 0,
              lowStockThreshold: Number(threshold) || 0,
              brand: defaults.brand || null,
              kind,
            });
            setBusy(false);
            if (err) return setError(err);
            onCreated(String(data.id));
          }}
          className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Create and link
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-card-border px-3 py-1.5 text-xs">
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-navy-600">It starts at 0 in stock; this purchase adds to it when the inventory switch is on.</p>
    </div>
  );
}

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

function PriceFlag({ p }: { p: Purchase }) {
  if (p.prevUnitPrice === null || !(p.quantity && p.quantity > 0)) return null;
  const now = p.price / p.quantity;
  const diff = now - p.prevUnitPrice;
  if (Math.abs(diff) < 0.005 || Math.abs(diff) / p.prevUnitPrice < 0.01) return null;
  const up = diff > 0;
  return (
    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${up ? "bg-red-50 text-status-out" : "bg-navy-100 text-status-good"}`}>
      {up ? "▲" : "▼"} {baht(Math.abs(diff))}/{p.unit || "unit"} vs {p.prevDate}
    </span>
  );
}

// ---------------------------------------------------------------------------
// One saved purchase
// ---------------------------------------------------------------------------

function PurchaseRow({ p, meta, onChanged, onMetaChanged }: { p: Purchase; meta: PurchaseInventoryMeta; onChanged: () => void; onMetaChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
  const [link, setLink] = useState<Link>({
    ingredientId: p.ingredientId,
    notInventory: p.notInventory,
    factor: p.stockQty !== null && p.quantity ? String(round3(p.stockQty / p.quantity)) : "",
  });

  async function save() {
    if (f.paidVia === "own_pocket" && !f.paidBy.trim()) return setError("Who paid from their own pocket?");
    const s = stockFor(meta, link, f.quantity, f.unit);
    setBusy(true);
    const { error: err } = await send(`/api/purchases/${p.id}`, "PATCH", {
      ...f,
      ingredientId: link.notInventory ? null : link.ingredientId,
      notInventory: link.notInventory,
      stockQty: s.qty,
    });
    setBusy(false);
    if (err) return setError(err);
    setEditing(false);
    setError(null);
    onChanged();
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const err = await uploadReceipt(file, p.batchId ? { batchId: p.batchId } : { purchaseId: p.id });
    setBusy(false);
    if (err) return setError(err);
    onChanged();
  }

  const invText = p.notInventory
    ? "not inventory"
    : p.ingredientName
      ? p.stockApplied
        ? `✓ +${p.stockQty} ${p.ingredientUnit} added to ${p.ingredientName}`
        : `→ ${p.ingredientName}${p.stockQty ? ` (+${p.stockQty} ${p.ingredientUnit})` : ""} · not added to stock`
      : "not linked to inventory";

  if (!editing) {
    return (
      <li className="py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-950">
              {p.item}
              {p.brand && <span className="font-normal text-navy-600"> · {p.brand}</span>}
              <PriceFlag p={p} />
            </p>
            <p className="text-xs text-navy-600">
              {p.quantity !== null ? `${p.quantity} ${p.unit ?? ""} · ` : p.unit ? `${p.unit} · ` : ""}
              {VIA_SHORT[p.paidVia]}
              {p.paidBy ? ` · paid by ${p.paidBy}` : ""}
              {p.paidVia === "own_pocket" && (p.reimbursedOn ? ` · paid back ${p.reimbursedOn}` : " · not paid back yet")}
              {p.note ? ` · ${p.note}` : ""}
            </p>
            <p className={`text-[11px] ${p.stockApplied ? "text-status-good" : "text-navy-600"}`}>{invText}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm font-semibold text-navy-950">{baht(p.price)}</span>
            <span className="flex items-center gap-2 text-xs">
              {p.hasReceipt && p.batchId ? (
                <a href={`/api/purchases/receipt?batch=${p.batchId}`} target="_blank" rel="noreferrer" className="text-navy-700 underline">
                  📷 Receipt
                </a>
              ) : (
                <label className="cursor-pointer text-navy-700 underline">
                  + photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => addPhoto(e.target.files?.[0])} />
                </label>
              )}
              <button type="button" onClick={() => setEditing(true)} className="text-navy-700 underline">
                Edit
              </button>
            </span>
          </div>
        </div>
        {error && <p className="text-xs text-status-out">{error}</p>}
      </li>
    );
  }

  return (
    <li className="my-2 space-y-2 rounded-lg bg-navy-100/60 p-3">
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
      <div className="space-y-1">
        <span className="text-xs text-navy-700">Inventory</span>
        <InventoryPicker
          meta={meta}
          link={link}
          onPick={(ingredientId, notInventory) => setLink({ ...link, ingredientId, notInventory, factor: "" })}
          onAddNew={() => setAdding(true)}
        />
        {adding && (
          <AddToInventoryForm
            defaults={{ name: f.item, unit: f.unit, brand: f.brand }}
            onCancel={() => setAdding(false)}
            onCreated={async (id) => {
              await onMetaChanged();
              setLink({ ingredientId: id, notInventory: false, factor: "" });
              setAdding(false);
            }}
          />
        )}
        <LinkDetails meta={meta} link={link} quantity={f.quantity} unit={f.unit} onFactor={(factor) => setLink({ ...link, factor })} />
        {p.stockApplied && <p className="text-[11px] text-navy-600">This purchase already added stock — saving changes stock by the difference only.</p>}
      </div>
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
            if (!window.confirm(`Delete "${p.item}" (${baht(p.price)})?${p.stockApplied ? " The stock it added will be taken back out." : ""}`)) return;
            setBusy(true);
            const { error: err } = await send(`/api/purchases/${p.id}`, "DELETE");
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
              const { error: err } = await send(`/api/purchases/${p.id}`, "PATCH", { reimbursedOn: date, reimbursedVia: via });
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

// ---------------------------------------------------------------------------
// Inventory switch + "add earlier purchases"
// ---------------------------------------------------------------------------

const STATUS_TEXT: Record<BackfillRow["status"], string> = {
  will_add: "will be added",
  already_added: "already added — skipped",
  covered_by_count: "bought before the last stock count — skipped",
  not_linked: "not linked to an inventory item — skipped",
  not_inventory: "not inventory — skipped",
};

function BackfillPanel({ meta, today, onDone, onClose }: { meta: PurchaseInventoryMeta; today: string; onDone: (msg: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"count" | "range">(meta.lastStockCount ? "count" : "range");
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<BackfillRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    const qs = mode === "count" ? "" : `?from=${from}&to=${to}`;
    try {
      const res = await fetch(`/api/purchases/backfill${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not load the preview.");
    } finally {
      setBusy(false);
    }
  }

  const willAdd = (rows ?? []).filter((r) => r.status === "will_add");
  const totals = useMemo(() => {
    const m = new Map<string, { qty: number; unit: string | null }>();
    for (const r of willAdd) {
      const k = r.ingredientName ?? "?";
      const cur = m.get(k) ?? { qty: 0, unit: r.unit };
      cur.qty += r.stockQty ?? 0;
      m.set(k, cur);
    }
    return Array.from(m.entries());
  }, [willAdd]);

  return (
    <div className="space-y-3 rounded-lg border border-navy-700/30 bg-navy-100/50 p-3">
      <p className="text-sm font-semibold text-navy-950">Add earlier purchases to stock</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" disabled={!meta.lastStockCount} onClick={() => { setMode("count"); setRows(null); }} className={`rounded-md px-3 py-1.5 ${mode === "count" ? "bg-navy-900 text-white" : "border border-card-border bg-white"} disabled:opacity-40`}>
          Since the last stock count
        </button>
        <button type="button" onClick={() => { setMode("range"); setRows(null); }} className={`rounded-md px-3 py-1.5 ${mode === "range" ? "bg-navy-900 text-white" : "border border-card-border bg-white"}`}>
          Pick dates
        </button>
      </div>
      {mode === "count" && meta.lastStockCount && <p className="text-xs text-navy-700">Last full stock count: {fmtDateTime(meta.lastStockCount)}</p>}
      {mode === "range" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          From <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRows(null); }} className="rounded-md border border-card-border px-2 py-1" />
          to <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setRows(null); }} className="rounded-md border border-card-border px-2 py-1" />
        </div>
      )}
      <p className="text-[11px] text-navy-600">
        Whatever you pick, a purchase is never added twice: anything already added, or bought before the last full stock count (it&rsquo;s already in that count), is skipped.
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={preview} className="rounded-md border border-card-border bg-white px-3 py-1.5 text-sm font-medium">
          {busy && !rows ? "Loading…" : "Preview"}
        </button>
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-navy-700 underline">
          Close
        </button>
      </div>
      {error && <p className="text-xs text-status-out">{error}</p>}
      {rows && (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-navy-600">No purchases in that period.</p>
          ) : (
            <>
              <p className="text-sm text-navy-900">
                <b>{willAdd.length}</b> purchase{willAdd.length === 1 ? "" : "s"} will be added; {rows.length - willAdd.length} skipped.
              </p>
              {totals.length > 0 && (
                <ul className="rounded-md bg-white p-2 text-xs">
                  {totals.map(([name, t]) => (
                    <li key={name} className="flex justify-between">
                      <span>{name}</span>
                      <span>
                        +{round3(t.qty)} {t.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-navy-700">Every purchase in the range</summary>
                <ul className="mt-1 space-y-0.5">
                  {rows.map((r) => (
                    <li key={r.purchaseId} className={r.status === "will_add" ? "text-navy-950" : "text-navy-600"}>
                      {r.purchaseDate} · {r.item}
                      {r.ingredientName ? ` → ${r.ingredientName}` : ""}
                      {r.stockQty ? ` (+${r.stockQty} ${r.unit ?? ""})` : ""} — {STATUS_TEXT[r.status]}
                    </li>
                  ))}
                </ul>
              </details>
              {willAdd.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { error: err, data } = await send("/api/purchases/backfill", "POST", mode === "count" ? {} : { from, to });
                    setBusy(false);
                    if (err) return setError(err);
                    onDone(`Added ${data.added} earlier purchase${data.added === 1 ? "" : "s"} to stock.`);
                  }}
                  className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add {willAdd.length} to stock
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InventorySwitchCard({ meta, today, onChanged }: { meta: PurchaseInventoryMeta; today: string; onChanged: (msg?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className={`card space-y-3 border-2 p-4 sm:p-5 ${meta.switchOn ? "border-status-good/50" : "border-card-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy-950">Purchases add to inventory: {meta.switchOn ? "ON" : "OFF"}</h2>
          <p className="text-xs text-navy-600">
            {meta.switchOn
              ? "Purchases linked to an inventory item add to its stock when saved."
              : "Purchases are only recorded. Links you set are remembered and can be added to stock later."}{" "}
            Last full stock count: {meta.lastStockCount ? fmtDateTime(meta.lastStockCount) : "never recorded"} (
            <a href="/admin/inventory" className="underline">
              record one on Inventory
            </a>
            ).
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error: err } = await send("/api/purchases/inventory", "POST", { on: !meta.switchOn });
            setBusy(false);
            if (err) return setError(err);
            if (!meta.switchOn) setShowBackfill(true);
            onChanged();
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${meta.switchOn ? "border border-card-border bg-white text-navy-900" : "bg-navy-900 text-white"} disabled:opacity-50`}
        >
          {meta.switchOn ? "Turn off" : "Turn on"}
        </button>
      </div>
      {meta.switchOn && (
        <p className="text-[11px] text-status-low">
          Sales take stock off only while the QR / counter switches on the Inventory page are on.
        </p>
      )}
      {meta.switchOn && !showBackfill && (
        <button type="button" onClick={() => setShowBackfill(true)} className="text-sm font-medium text-navy-800 underline">
          Add earlier purchases to stock…
        </button>
      )}
      {showBackfill && meta.switchOn && (
        <BackfillPanel
          meta={meta}
          today={today}
          onClose={() => setShowBackfill(false)}
          onDone={(msg) => {
            setShowBackfill(false);
            onChanged(msg);
          }}
        />
      )}
      {error && <p className="text-xs text-status-out">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shopping list
// ---------------------------------------------------------------------------

function ShoppingCard({
  items,
  onItems,
  onBuy,
  buyingIds,
}: {
  items: ShoppingItem[];
  onItems: (items: ShoppingItem[]) => void;
  onBuy: (item: ShoppingItem) => void;
  buyingIds: number[];
}) {
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  async function refresh() {
    const res = await fetch("/api/shopping", { cache: "no-store" }).catch(() => null);
    if (res?.ok) onItems((await res.json()).items);
  }

  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-navy-950">To buy ({open.length})</h2>
        <button
          type="button"
          onClick={async () => {
            const { error, data } = await send("/api/shopping", "POST", { fromLowStock: true });
            setMsg(error ?? (data.added ? `Low-stock items added.` : "Nothing is low on stock right now."));
            if (data.items) onItems(data.items as ShoppingItem[]);
          }}
          className="rounded-md border border-card-border px-3 py-1.5 text-xs font-semibold text-navy-900"
        >
          + Add everything that&rsquo;s low on stock
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim()) return;
          const { error, data } = await send("/api/shopping", "POST", { label });
          if (error) return setMsg(error);
          setLabel("");
          if (data.items) onItems(data.items as ShoppingItem[]);
        }}
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add something to buy" className={`${input} flex-1`} />
        <button className="rounded-md border border-card-border px-3 text-sm font-medium">Add</button>
      </form>
      {msg && <p className="text-xs text-navy-700">{msg}</p>}
      {open.length === 0 ? (
        <p className="text-sm text-navy-600">Nothing on the list.</p>
      ) : (
        <ul className="divide-y divide-card-border">
          {open.map((i) => {
            const buying = buyingIds.includes(i.id);
            return (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <label className="flex min-w-0 items-center gap-2 text-sm">
                  <input type="checkbox" checked={buying} onChange={() => onBuy(i)} className="h-5 w-5" />
                  <span className={buying ? "text-navy-600" : "text-navy-950"}>
                    {i.label}
                    {i.note && <span className="ml-1 text-xs text-navy-600">({i.note})</span>}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    await send(`/api/shopping/${i.id}`, "DELETE");
                    refresh();
                  }}
                  className="text-xs text-navy-600 underline"
                >
                  remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-navy-600">Tick an item when you buy it: it&rsquo;s added to the purchase form below (already linked to inventory). It leaves the list when you save.</p>
      {done.length > 0 && <p className="text-[11px] text-navy-600">Bought today: {done.map((d) => d.label).join(", ")}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Line = { item: string; brand: string; quantity: string; unit: string; price: string; link: Link; linkTouched: boolean; shoppingId?: number; adding?: boolean };
const emptyLine = (): Line => ({ item: "", brand: "", quantity: "", unit: "", price: "", link: { ingredientId: null, notInventory: false, factor: "" }, linkTouched: false });

export default function PurchasesClient({ today, staff }: { today: string; staff: StaffMember[] }) {
  const [date, setDate] = useState(today);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [owedBack, setOwedBack] = useState<Purchase[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions>({ items: [], brands: [], units: [], payers: [] });
  const [meta, setMeta] = useState<PurchaseInventoryMeta>(EMPTY_META);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [addDate, setAddDate] = useState(today);
  const [paidVia, setPaidVia] = useState<PurchasePaidVia>("drawer");
  const [paidBy, setPaidBy] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
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
      setMeta(data.inventory);
      setShopping(data.shopping);
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

  const reloadMeta = useCallback(async () => {
    await load(date);
  }, [load, date]);

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

  // When an item name is typed that was linked before, fill in the link.
  function onItemTyped(i: number, item: string) {
    const remembered = meta.links[item.trim().toLowerCase()];
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, item };
        if (!l.linkTouched) {
          next.link = remembered
            ? { ingredientId: remembered.ingredientId, notInventory: remembered.notInventory, factor: "" }
            : { ingredientId: null, notInventory: false, factor: "" };
        }
        return next;
      })
    );
  }

  function buyFromList(s: ShoppingItem) {
    setLines((prev) => {
      if (prev.some((l) => l.shoppingId === s.id)) {
        const rest = prev.filter((l) => l.shoppingId !== s.id);
        return rest.length > 0 ? rest : [emptyLine()];
      }
      const ing = meta.ingredients.find((x) => x.id === s.ingredientId);
      // Buy in kg / L when the item is tracked in g / ml.
      const buyUnit = !ing ? "" : normUnit(ing.unit) === "g" ? "kg" : normUnit(ing.unit) === "ml" ? "L" : ing.unit;
      const line: Line = {
        ...emptyLine(),
        item: s.label,
        brand: ing?.brand ?? "",
        unit: buyUnit,
        link: { ingredientId: s.ingredientId, notInventory: false, factor: "" },
        linkTouched: !!s.ingredientId,
        shoppingId: s.id,
      };
      const blankIdx = prev.findIndex((l) => !l.item && !l.price && !l.shoppingId);
      if (blankIdx >= 0) return prev.map((l, j) => (j === blankIdx ? line : l));
      return [...prev, line];
    });
  }

  async function saveAll() {
    setFormError(null);
    setSaved(null);
    const filled = lines.filter((l) => l.item.trim() || l.price.trim());
    if (filled.length === 0) return setFormError("Add at least one item.");
    if (filled.some((l) => !l.item.trim())) return setFormError("Every line needs an item name.");
    if (filled.some((l) => l.price.trim() === "" || Number.isNaN(Number(l.price)))) return setFormError("Every line needs a price.");
    if (paidVia === "own_pocket" && !paidBy.trim()) return setFormError("Who paid from their own pocket?");
    const rows = filled.map((l) => {
      const s = stockFor(meta, l.link, l.quantity, l.unit);
      return {
        purchaseDate: addDate,
        item: l.item,
        brand: l.brand,
        quantity: l.quantity,
        unit: l.unit,
        price: l.price,
        paidVia,
        paidBy,
        note,
        ingredientId: l.link.notInventory ? null : l.link.ingredientId,
        notInventory: l.link.notInventory,
        stockQty: s.qty,
      };
    });
    const missing = filled.filter((l) => {
      const s = stockFor(meta, l.link, l.quantity, l.unit);
      return l.link.ingredientId && !l.link.notInventory && s.qty === null;
    });
    if (missing.length > 0 && !window.confirm(`${missing.map((l) => l.item).join(", ")}: the stock amount isn't filled in, so ${missing.length === 1 ? "it" : "they"} won't add to inventory. Save anyway?`)) return;

    setSaving(true);
    const { error: err, data } = await send("/api/purchases", "POST", {
      staffId,
      rows,
      shoppingIds: filled.map((l) => l.shoppingId).filter((x): x is number => typeof x === "number"),
    });
    if (err) {
      setSaving(false);
      return setFormError(err);
    }
    let photoMsg = "";
    if (photo && data.batchId) {
      const perr = await uploadReceipt(photo, { batchId: String(data.batchId) });
      photoMsg = perr ? ` Photo not saved: ${perr}` : " Receipt photo saved.";
    }
    setSaving(false);
    const added = Number(data.added ?? 0);
    setSaved(
      `Saved ${filled.length} item${filled.length === 1 ? "" : "s"} (${baht(filled.reduce((s, l) => s + Number(l.price), 0))}).${added ? ` ${added} added to inventory.` : ""}${photoMsg}`
    );
    setLines([emptyLine()]);
    setNote("");
    setPhoto(null);
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

      <InventorySwitchCard
        meta={meta}
        today={today}
        onChanged={(msg) => {
          if (msg) setSaved(msg);
          load(date);
        }}
      />

      <ShoppingCard items={shopping} onItems={setShopping} onBuy={buyFromList} buyingIds={lines.map((l) => l.shoppingId).filter((x): x is number => typeof x === "number")} />

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

        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-card-border p-2">
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                <input list="pt-items" value={l.item} onChange={(e) => onItemTyped(i, e.target.value)} placeholder="Item" className={`${input} col-span-6 sm:col-span-4`} />
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
              <div className="grid gap-2 sm:grid-cols-2">
                <InventoryPicker
                  meta={meta}
                  link={l.link}
                  onPick={(ingredientId, notInventory) => setLine(i, { link: { ingredientId, notInventory, factor: "" }, linkTouched: true })}
                  onAddNew={() => setLine(i, { adding: true })}
                />
                <LinkDetails meta={meta} link={l.link} quantity={l.quantity} unit={l.unit} onFactor={(factor) => setLine(i, { link: { ...l.link, factor } })} />
              </div>
              {l.adding && (
                <AddToInventoryForm
                  defaults={{ name: l.item, unit: l.unit, brand: l.brand }}
                  onCancel={() => setLine(i, { adding: false })}
                  onCreated={async (id) => {
                    await reloadMeta();
                    setLine(i, { adding: false, link: { ingredientId: id, notInventory: false, factor: "" }, linkTouched: true });
                  }}
                />
              )}
            </div>
          ))}
          <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="text-sm font-medium text-navy-800 underline">
            + Add another item
          </button>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, e.g. Makro trip)" className={input} />
        <label className="flex flex-wrap items-center gap-2 text-sm text-navy-800">
          <span>Receipt photo (optional):</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="text-xs" />
        </label>

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
              <PurchaseRow key={JSON.stringify(p)} p={p} meta={meta} onChanged={() => load(date)} onMetaChanged={reloadMeta} />
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
