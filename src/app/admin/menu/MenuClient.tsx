"use client";

import { useState } from "react";
import type { Ingredient, MenuItemAdminView } from "@/lib/types";

function ItemCard({ item, ingredients, onChanged }: { item: MenuItemAdminView; ingredients: Ingredient[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [price, setPrice] = useState(String(item.price));
  const [active, setActive] = useState(item.active);
  const [busy, setBusy] = useState(false);
  const [linkIngredientId, setLinkIngredientId] = useState("");
  const [linkQty, setLinkQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(item.ingredients.map((l) => l.ingredientId));
  const availableToLink = ingredients.filter((i) => !linkedIds.has(i.id));

  async function saveDetails() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: item.code, name, category, price: Number(price), active }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not save.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    const next = !active;
    setActive(next);
    setBusy(true);
    try {
      await fetch(`/api/menu/${item.code}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    if (!linkIngredientId || !linkQty || Number(linkQty) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/menu/${item.code}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId: linkIngredientId, qtyPerOrder: Number(linkQty) }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not link ingredient.");
        return;
      }
      setLinkIngredientId("");
      setLinkQty("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(ingredientId: string) {
    setBusy(true);
    try {
      await fetch(`/api/menu/${item.code}/ingredients/${ingredientId}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-navy-600">{item.code}</p>
          <p className="font-medium text-navy-950">{item.name}</p>
          <p className="text-sm text-navy-600">
            {item.category} &middot; ฿{item.price}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-navy-700">
            <input type="checkbox" checked={active} onChange={toggleActive} disabled={busy} />
            Active
          </label>
          <button onClick={() => setExpanded((e) => !e)} className="text-xs font-medium text-navy-700 underline">
            {expanded ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-card-border pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-md border border-card-border px-3 py-2 text-sm" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="rounded-md border border-card-border px-3 py-2 text-sm" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Price" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          </div>
          <button onClick={saveDetails} disabled={busy} className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            Save details
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Ingredients used per order</p>
            <ul className="mt-2 space-y-1">
              {item.ingredients.length === 0 && <li className="text-sm text-navy-500">No ingredients linked yet.</li>}
              {item.ingredients.map((l) => (
                <li key={l.ingredientId} className="flex items-center justify-between text-sm text-navy-800">
                  <span>
                    {l.ingredientName} &mdash; {l.qtyPerOrder} {l.unit}
                  </span>
                  <button onClick={() => removeLink(l.ingredientId)} disabled={busy} className="text-xs text-status-out hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            {availableToLink.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <select value={linkIngredientId} onChange={(e) => setLinkIngredientId(e.target.value)} className="rounded-md border border-card-border px-2 py-1.5 text-sm">
                  <option value="">Add ingredient…</option>
                  {availableToLink.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
                <input
                  value={linkQty}
                  onChange={(e) => setLinkQty(e.target.value)}
                  type="number"
                  placeholder="Qty per order"
                  className="w-28 rounded-md border border-card-border px-2 py-1.5 text-sm"
                />
                <button onClick={addLink} disabled={busy} className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50">
                  Link
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-status-out">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function MenuClient({ initialItems, ingredients }: { initialItems: MenuItemAdminView[]; ingredients: Ingredient[] }) {
  const [items] = useState(initialItems);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    window.location.reload();
  }

  async function addItem() {
    if (!newCode.trim() || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim(), name: newName.trim(), category: newCategory.trim() || "Other", price: Number(newPrice) || 0, active: true }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not add item.");
        return;
      }
      window.location.reload();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {items.map((item) => (
          <ItemCard key={item.code} item={item} ingredients={ingredients} onChanged={refresh} />
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Add a new menu item</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code (CT007)" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" placeholder="Price" className="rounded-md border border-card-border px-3 py-2 text-sm" />
        </div>
        {error && <p className="mt-2 text-sm text-status-out">{error}</p>}
        <p className="mt-2 text-xs text-navy-600">Add ingredients from the item&rsquo;s Edit panel once it&rsquo;s created.</p>
        <button onClick={addItem} disabled={creating} className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
          Add item
        </button>
      </div>
    </div>
  );
}
