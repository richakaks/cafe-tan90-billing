"use client";

import { useState } from "react";
import type { Ingredient, StockAdjustmentRow } from "@/lib/types";
import { ingredientAlertStatus } from "@/lib/stock";

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

function Row({ ingredient, onChanged }: { ingredient: Ingredient; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [threshold, setThreshold] = useState(String(ingredient.lowStockThreshold));
  const [busy, setBusy] = useState(false);
  const status = statusFor(ingredient);

  async function restock(sign: 1 | -1) {
    const n = Number(amount);
    if (!n || n <= 0) return;
    setBusy(true);
    try {
      await fetch(`/api/inventory/${ingredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: sign * n }),
      });
      setAmount("");
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
    <tr className="border-t border-card-border">
      <td className="py-3 pr-3">
        <p className="font-medium text-navy-950">{ingredient.name}</p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
      </td>
      <td className="py-3 pr-3 text-sm text-navy-800">
        {ingredient.currentStock} {ingredient.unit}
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-20 rounded-md border border-card-border px-2 py-1 text-sm"
          />
          <button
            disabled={busy}
            onClick={() => restock(1)}
            className="rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            + Restock
          </button>
          <button
            disabled={busy}
            onClick={() => restock(-1)}
            className="rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
          >
            − Use
          </button>
        </div>
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

export default function InventoryClient({
  initialIngredients,
  initialAdjustments,
}: {
  initialIngredients: Ingredient[];
  initialAdjustments: StockAdjustmentRow[];
}) {
  const [ingredients] = useState(initialIngredients);
  const [adjustments] = useState(initialAdjustments);
  const lowOrOut = ingredients.filter((ing) => ingredientAlertStatus(ing) !== null);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setNewUnit("");
      setNewStock("");
      setNewThreshold("");
      window.location.reload();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {lowOrOut.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-status-low">
            {lowOrOut.length} ingredient{lowOrOut.length === 1 ? "" : "s"} need{lowOrOut.length === 1 ? "s" : ""} attention
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-800">
            {lowOrOut.map((ing) => (
              <li key={ing.id}>
                {ing.name} — {ing.currentStock <= 0 ? "out" : `${ing.currentStock} ${ing.unit} left`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto p-5">
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
            {ingredients.map((ing) => (
              <Row key={ing.id} ingredient={ing} onChanged={refresh} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Add a new ingredient</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="col-span-2 rounded-md border border-card-border px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder="Unit (g, ml, pcs…)"
            className="rounded-md border border-card-border px-3 py-2 text-sm"
          />
          <input
            value={newStock}
            onChange={(e) => setNewStock(e.target.value)}
            type="number"
            placeholder="Starting stock"
            className="rounded-md border border-card-border px-3 py-2 text-sm"
          />
          <input
            value={newThreshold}
            onChange={(e) => setNewThreshold(e.target.value)}
            type="number"
            placeholder="Low-stock threshold"
            className="rounded-md border border-card-border px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="mt-2 text-sm text-status-out">{error}</p>}
        <button
          onClick={addIngredient}
          disabled={creating}
          className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
        >
          Add ingredient
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Recent stock changes</h2>
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
                </span>
                <span className="shrink-0 text-xs text-navy-600">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
