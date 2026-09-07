"use client";

import Link from "next/link";
import { useState } from "react";
import type { Ingredient, LastRestockPrice, StockAdjustmentRow } from "@/lib/types";
import { ingredientAlertStatus } from "@/lib/stock";
import { RangeResetOrdersButton, ResetButton } from "@/components/OrdersDangerZone";

function statusFor(ing: Ingredient): { label: string; className: string } {
  const alert = ingredientAlertStatus(ing);
  if (alert === "out_of_stock") return { label: "Out of stock", className: "bg-red-50 text-status-out border border-red-200" };
  if (alert === "low_stock") return { label: "Low", className: "bg-amber-50 text-status-low border border-amber-200" };
  return { label: "OK", className: "bg-green-50 text-status-good border border-green-200" };
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

function EditIngredientForm({
  ingredient,
  onCancel,
  onSaved,
}: {
  ingredient: Ingredient;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(ingredient.name);
  const [brand, setBrand] = useState(ingredient.brand ?? "");
  const [unit, setUnit] = useState(ingredient.unit);
  const [stock, setStock] = useState(String(ingredient.currentStock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !unit.trim()) {
      setError("Name and unit can't be empty.");
      return;
    }
    const stockNum = Number(stock);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      setError("Current stock must be a number, 0 or more.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() !== ingredient.name) body.name = name.trim();
      if (unit.trim() !== ingredient.unit) body.unit = unit.trim();
      const trimmedBrand = brand.trim();
      if (trimmedBrand !== (ingredient.brand ?? "")) body.brand = trimmedBrand || null;
      if (stockNum !== ingredient.currentStock) body.currentStock = stockNum;

      if (Object.keys(body).length === 0) {
        onCancel();
        return;
      }
      const res = await fetch(`/api/inventory/${ingredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json();
        setError(b.error ?? "Could not save changes.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full rounded-md border border-card-border px-2 py-1 text-sm"
      />
      <input
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="Brand (optional)"
        className="w-full rounded-md border border-card-border px-2 py-1 text-sm"
      />
      <div className="flex gap-1.5">
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit"
          className="w-1/2 rounded-md border border-card-border px-2 py-1 text-sm"
        />
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Current stock"
          className="w-1/2 rounded-md border border-card-border px-2 py-1 text-sm"
        />
      </div>
      {error && <p className="text-xs text-status-out">{error}</p>}
      <div className="flex gap-1.5">
        <button
          disabled={busy}
          onClick={save}
          className="rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
        >
          Save
        </button>
        <button
          disabled={busy}
          onClick={onCancel}
          className="rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({
  ingredient,
  lastRestock,
  usedIn,
  onChanged,
  highlighted,
}: {
  ingredient: Ingredient;
  lastRestock?: LastRestockPrice;
  usedIn: string[];
  onChanged: () => void;
  highlighted?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [threshold, setThreshold] = useState(String(ingredient.lowStockThreshold));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const status = statusFor(ingredient);

  async function confirmDelete() {
    setBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/inventory/${ingredient.id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json();
        setDeleteError(b.error ?? "Could not delete this ingredient.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function restock(sign: 1 | -1) {
    const n = Number(amount);
    if (!n || n <= 0) return;
    // Price paid is only meaningful for a +Restock (buying more), never for
    // a -Use entry — sending it on a use-up would misrepresent what it cost
    // to buy the ingredient, since a use-up doesn't buy anything.
    const p = sign === 1 && price.trim() !== "" ? Number(price) : undefined;
    if (p !== undefined && (Number.isNaN(p) || p < 0)) return;
    setBusy(true);
    try {
      await fetch(`/api/inventory/${ingredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: sign * n, ...(p !== undefined ? { pricePaid: p } : {}) }),
      });
      setAmount("");
      setPrice("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function saveThreshold() {
    const n = Number(threshold);
    if (Number.isNaN(n) || n < 0) return;
    setBusy(true);
    try {
      await fetch(`/api/inventory/${ingredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: n }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr
      id={`ingredient-row-${ingredient.id}`}
      className={`border-t border-card-border transition-colors ${highlighted ? "bg-amber-100" : ""}`}
    >
      <td className="py-3 pr-3 align-top">
        {editing ? (
          <EditIngredientForm ingredient={ingredient} onCancel={() => setEditing(false)} onSaved={onChanged} />
        ) : confirmingDelete ? (
          <div className="max-w-[260px] rounded-md border border-status-out/40 bg-red-50 p-2.5">
            <p className="text-xs font-semibold text-status-out">Delete {ingredient.name}?</p>
            <p className="mt-1 text-xs text-navy-700">
              {usedIn.length > 0
                ? `This removes it from ${usedIn.length} recipe${usedIn.length === 1 ? "" : "s"} (${usedIn.join(", ")}) and deletes its restock/use history. This can't be undone.`
                : "This deletes its restock/use history too. This can't be undone."}
            </p>
            {deleteError && <p className="mt-1 text-xs text-status-out">{deleteError}</p>}
            <div className="mt-2 flex gap-1.5">
              <button
                disabled={busy}
                onClick={confirmDelete}
                className="rounded-md bg-status-out px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Yes, delete
              </button>
              <button
                disabled={busy}
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-navy-950">{ingredient.name}</p>
            {ingredient.brand && <p className="text-xs text-navy-500">{ingredient.brand}</p>}
            {usedIn.length > 0 && <p className="text-xs text-navy-500">Used in: {usedIn.join(", ")}</p>}
            <div className="mt-1 flex items-center gap-3">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
              <button onClick={() => setEditing(true)} className="text-xs font-medium text-navy-700 underline decoration-dotted">
                Edit
              </button>
              <button onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-status-out underline decoration-dotted">
                Delete
              </button>
            </div>
          </>
        )}
      </td>
      <td className="py-3 pr-3 text-sm text-navy-800">
        {ingredient.currentStock} {ingredient.unit}
      </td>
      <td className="py-3 pr-3">
        <div className="flex max-w-[240px] flex-col gap-1.5">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded-md border border-card-border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="฿ paid (optional)"
            title="Total price paid for this restock — leave blank if unknown"
            className="w-full rounded-md border border-card-border px-2 py-1.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <button
              disabled={busy}
              onClick={() => restock(1)}
              className="rounded-md bg-navy-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              + Restock
            </button>
            <button
              disabled={busy}
              onClick={() => restock(-1)}
              className="rounded-md border border-card-border px-2 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
            >
              − Use
            </button>
          </div>
        </div>
        {lastRestock && (
          <p className="mt-1 text-xs text-navy-600">
            Last bought: +{lastRestock.delta} {ingredient.unit} for ฿{lastRestock.pricePaid.toLocaleString("en-US")} ·{" "}
            {timeAgo(lastRestock.createdAt)}
          </p>
        )}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-16 rounded-md border border-card-border px-2 py-1 text-sm"
          />
          <span className="text-xs text-navy-600">{ingredient.unit}</span>
          <button
            disabled={busy}
            onClick={saveThreshold}
            className="rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </td>
    </tr>
  );
}

function DangerZone() {
  return (
    <div className="card border-status-out/40 p-5">
      <h2 className="text-sm font-semibold text-status-out">Danger zone</h2>
      <p className="mt-1 text-xs text-navy-600">
        Testing/setup tools. All of these are permanent and affect the whole system, not just what you can see here.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ResetButton
          label="Reset all orders"
          confirmLabel="Yes, delete all orders"
          warning="This permanently deletes every order (open, served, and paid) and frees up any coupon codes they'd redeemed. It does not touch ingredient stock levels. To only clear some dates instead of everything, use “Reset orders in a date range” below."
          endpoint="/api/admin/reset-orders"
        />
        <RangeResetOrdersButton />
        <ResetButton
          label="Reset all stock to 0"
          confirmLabel="Yes, zero out all stock"
          warning="This sets every ingredient's current stock to 0. It does not touch orders. The zeroing itself still gets logged to stock history below, same as any other adjustment."
          endpoint="/api/admin/reset-stock"
        />
        <ResetButton
          label="Clear stock history"
          confirmLabel="Yes, clear stock history"
          warning="This permanently deletes every entry from the stock-change history log (here and on the full history/export page). It does not change any ingredient's current stock — only the log of how it got there."
          endpoint="/api/admin/clear-stock-history"
        />
      </div>
    </div>
  );
}

export default function InventoryClient({
  initialIngredients,
  initialAdjustments,
  lastRestockPrices,
  usage,
}: {
  initialIngredients: Ingredient[];
  initialAdjustments: StockAdjustmentRow[];
  lastRestockPrices: Record<string, LastRestockPrice>;
  usage: Record<string, string[]>;
}) {
  const [ingredients] = useState(initialIngredients);
  const [adjustments] = useState(initialAdjustments);
  // Priority = how many menu items this ingredient is used in -- an
  // ingredient that's out of stock on a bestseller-heavy item is worth
  // restocking before a niche one, even if both are equally "out."
  // Ties (including two ingredients used in zero recipes) fall back to name.
  const lowOrOut = ingredients
    .filter((ing) => ingredientAlertStatus(ing) !== null)
    .sort((a, b) => (usage[b.id]?.length ?? 0) - (usage[a.id]?.length ?? 0) || a.name.localeCompare(b.name));
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Jumps from a "needs attention" banner row down to that ingredient's row
  // in the table below -- clears any active search first (the row could be
  // filtered out), waits a tick for the table to re-render with it visible,
  // then scrolls it into view and briefly highlights it.
  function goToIngredient(id: string) {
    setQuery("");
    setHighlightedId(id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`ingredient-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    setTimeout(() => setHighlightedId((current) => (current === id ? null : current)), 2500);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleIngredients = normalizedQuery
    ? ingredients.filter(
        (ing) => ing.name.toLowerCase().includes(normalizedQuery) || (ing.brand ?? "").toLowerCase().includes(normalizedQuery),
      )
    : ingredients;

  function refresh() {
    window.location.reload();
  }

  async function addIngredient() {
    if (!newName.trim() || !newUnit.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          brand: newBrand.trim() || null,
          unit: newUnit.trim(),
          currentStock: Number(newStock) || 0,
          lowStockThreshold: Number(newThreshold) || 0,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not add ingredient.");
        return;
      }
      setNewName("");
      setNewBrand("");
      setNewUnit("");
      setNewStock("");
      setNewThreshold("");
      window.location.reload();
    } finally {
      setCreating(false);
    }
  }

  function clearNewIngredientForm() {
    setNewName("");
    setNewBrand("");
    setNewUnit("");
    setNewStock("");
    setNewThreshold("");
    setError(null);
  }

  return (
    <div className="space-y-8">
      {lowOrOut.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-status-low">
            {lowOrOut.length} ingredient{lowOrOut.length === 1 ? "" : "s"} need{lowOrOut.length === 1 ? "s" : ""} attention
          </p>
          <p className="mt-0.5 text-xs text-navy-600">Listed by how many menu items rely on them — most-used first.</p>
          <ul className="mt-3 divide-y divide-amber-200/60 text-sm text-navy-800">
            {lowOrOut.map((ing) => {
              const usedInCount = usage[ing.id]?.length ?? 0;
              return (
                <li key={ing.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span>
                    {ing.name}
                    {usedInCount > 0 && (
                      <span className="ml-2 text-xs text-navy-500">
                        used in {usedInCount} item{usedInCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={ing.currentStock <= 0 ? "font-medium text-status-out" : "text-status-low"}>
                      {ing.currentStock <= 0 ? "Out" : `${ing.currentStock} ${ing.unit} left`}
                    </span>
                    <button onClick={() => goToIngredient(ing.id)} className="text-xs font-medium text-navy-700 underline hover:text-navy-950">
                      Go to ingredient
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an ingredient…"
          className="w-full rounded-md border border-card-border px-3 py-2 text-sm"
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-navy-600">
                <th className="pb-2">Ingredient</th>
                <th className="pb-2">Current stock</th>
                <th className="pb-2">Restock / use</th>
                <th className="pb-2">Low-stock threshold</th>
              </tr>
            </thead>
            <tbody>
              {visibleIngredients.map((ing) => (
                <Row
                  key={ing.id}
                  ingredient={ing}
                  lastRestock={lastRestockPrices[ing.id]}
                  usedIn={usage[ing.id] ?? []}
                  onChanged={refresh}
                  highlighted={highlightedId === ing.id}
                />
              ))}
            </tbody>
          </table>
          {visibleIngredients.length === 0 && <p className="py-4 text-sm text-navy-600">No ingredient matches “{query}”.</p>}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Add a new ingredient</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-600">Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Frozen Fries"
              className="w-full rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-600">Brand (optional)</span>
            <input
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="e.g. Lays"
              className="w-full rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-600">Unit</span>
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="g, ml, pcs…"
              className="w-full rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-600">Starting stock</span>
            <input
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              type="number"
              min={0}
              placeholder="0"
              className="w-full rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-600">Low-stock threshold</span>
            <input
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              type="number"
              min={0}
              placeholder="0"
              className="w-full rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-status-out">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={addIngredient}
            disabled={creating}
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            Add ingredient
          </button>
          <button
            onClick={clearNewIngredientForm}
            disabled={creating}
            className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-950">Recent stock changes</h2>
          <Link href="/admin/inventory/history" className="text-xs font-medium text-navy-700 underline">
            Full history &amp; export
          </Link>
        </div>
        <p className="mt-1 text-xs text-navy-600">Every restock or manual use-up entered above, most recent first.</p>
        {adjustments.length === 0 ? (
          <p className="mt-3 text-sm text-navy-600">No stock changes logged yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-navy-900">{a.ingredientName}</span>
                <span className={a.delta >= 0 ? "text-status-good" : "text-navy-700"}>
                  {a.delta >= 0 ? "+" : ""}
                  {a.delta} &rarr; {a.resultingStock}
                  {a.pricePaid !== null && <span className="text-navy-600"> (฿{a.pricePaid.toLocaleString("en-US")})</span>}
                </span>
                <span className="shrink-0 text-xs text-navy-600">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DangerZone />
    </div>
  );
}
