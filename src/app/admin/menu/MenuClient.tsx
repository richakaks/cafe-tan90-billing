"use client";

import { useMemo, useState } from "react";
import type { Ingredient, MenuItem, MenuItemAdminView } from "@/lib/types";
import ImageCropUpload from "@/components/ImageCropUpload";

type LinkedIngredient = MenuItemAdminView["ingredients"][number];

const PACKAGING_TYPE_OPTIONS: { value: MenuItem["packagingType"]; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "hot_drink", label: "Drink — Hot" },
  { value: "cold_drink", label: "Drink — Cold" },
];

function LinkedIngredientRow({
  itemCode,
  link,
  busy,
  onChanged,
  onRemove,
}: {
  itemCode: string;
  link: LinkedIngredient;
  busy: boolean;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const [qty, setQty] = useState(String(link.qtyPerOrder));
  // Round 22: typable display-only override, shown instead of the
  // ingredient's real unit. Falls back to the real unit when blank -- this
  // never changes what qty actually deducts, only what's displayed.
  const [unitLabel, setUnitLabel] = useState(link.unitLabel ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = Number(qty) !== link.qtyPerOrder || unitLabel !== (link.unitLabel ?? "");

  async function save() {
    const n = Number(qty);
    if (!n || n <= 0) return;
    setSaving(true);
    try {
      await fetch(`/api/menu/${itemCode}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId: link.ingredientId, qtyPerOrder: n, unitLabel: unitLabel.trim() || null }),
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm text-navy-800">
      <span className="min-w-0 flex-1 truncate">{link.ingredientName}</span>
      <input
        type="number"
        min={0}
        step="any"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="w-20 rounded-md border border-card-border px-2 py-1 text-sm"
      />
      <input
        value={unitLabel}
        onChange={(e) => setUnitLabel(e.target.value)}
        placeholder={link.unit}
        title="Unit label shown here (display only -- stock still deducts using the ingredient's real unit)"
        className="w-14 shrink-0 rounded-md border border-card-border px-1.5 py-1 text-xs"
      />
      {dirty && (
        <button onClick={save} disabled={busy || saving} className="shrink-0 text-xs font-medium text-status-good hover:underline">
          Save
        </button>
      )}
      <button onClick={onRemove} disabled={busy || saving} className="shrink-0 text-xs text-status-out hover:underline">
        Remove
      </button>
    </li>
  );
}

function DragHandle({ onGrab, onRelease }: { onGrab: () => void; onRelease: () => void }) {
  return (
    <span
      aria-hidden="true"
      title="Drag to reorder within this category"
      onMouseDown={onGrab}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      className="mt-5 flex shrink-0 cursor-grab select-none flex-col items-center justify-center gap-[3px] self-start rounded px-1.5 py-2 text-navy-400 hover:bg-navy-100 hover:text-navy-700 active:cursor-grabbing"
    >
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-4 rounded-full bg-current" />
    </span>
  );
}

// Wraps one ItemCard with a drag handle on the left so it can be reordered
// within its category (drag never crosses into another category's section —
// see reorderWithinCategory). Native HTML5 drag-and-drop, no library: the
// row is only made `draggable` while the mouse is held down on the handle
// itself, so dragging the card's own inputs/buttons still works normally.
function DraggableItem({
  item,
  ingredients,
  onChanged,
  onDropReorder,
}: {
  item: MenuItemAdminView;
  ingredients: Ingredient[];
  onChanged: () => void;
  onDropReorder: (draggedCode: string, targetCode: string) => void;
}) {
  const [dragEnabled, setDragEnabled] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable={dragEnabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.code);
      }}
      onDragEnd={() => setDragEnabled(false)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const draggedCode = e.dataTransfer.getData("text/plain");
        if (draggedCode && draggedCode !== item.code) onDropReorder(draggedCode, item.code);
      }}
      className={`flex items-start gap-1 rounded-xl transition ${dragOver ? "ring-2 ring-navy-600" : ""}`}
    >
      <DragHandle onGrab={() => setDragEnabled(true)} onRelease={() => setDragEnabled(false)} />
      <div className="min-w-0 flex-1">
        <ItemCard item={item} ingredients={ingredients} onChanged={onChanged} />
      </div>
    </div>
  );
}

function ItemCard({ item, ingredients, onChanged }: { item: MenuItemAdminView; ingredients: Ingredient[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [price, setPrice] = useState(String(item.price));
  const [packagingType, setPackagingType] = useState(item.packagingType);
  const [yieldServings, setYieldServings] = useState(String(item.yieldServings));
  const [description, setDescription] = useState(item.description ?? "");
  const [imageUrl, setImageUrl] = useState(item.imageUrl);
  const [active, setActive] = useState(item.active);
  const [busy, setBusy] = useState(false);
  const [linkIngredientId, setLinkIngredientId] = useState("");
  const [linkQty, setLinkQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [codeInput, setCodeInput] = useState(item.code);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirmingCode, setConfirmingCode] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const linkedIds = new Set(item.ingredients.map((l) => l.ingredientId));
  const availableToLink = ingredients.filter((i) => !linkedIds.has(i.id));

  async function saveDetails() {
    const yieldNum = Number(yieldServings);
    if (!yieldNum || yieldNum <= 0) {
      setError("Yield (servings) must be a number greater than 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: item.code,
          name,
          category,
          price: Number(price),
          active,
          packagingType,
          yieldServings: yieldNum,
          description: description.trim() || null,
        }),
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

  async function saveCode() {
    const trimmed = codeInput.trim();
    if (!trimmed || trimmed === item.code) {
      setConfirmingCode(false);
      return;
    }
    setCodeBusy(true);
    setCodeError(null);
    try {
      const res = await fetch(`/api/menu/${item.code}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCode: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json();
        setCodeError(body.error ?? "Could not change this item's code.");
        return;
      }
      onChanged();
    } finally {
      setCodeBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/menu/${item.code}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setDeleteError(body.error ?? "Could not delete this item.");
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Item code</p>
            <p className="mt-1 text-xs text-navy-600">
              This is the item&rsquo;s permanent ID. Changing it updates its recipe links, historical sales, and every past order that used it.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  setConfirmingCode(false);
                }}
                className="w-40 rounded-md border border-card-border px-2 py-1.5 font-mono text-sm"
              />
              {!confirmingCode ? (
                <button
                  onClick={() => setConfirmingCode(true)}
                  disabled={codeBusy || !codeInput.trim() || codeInput.trim() === item.code}
                  className="rounded-md border border-card-border px-2 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
                >
                  Change code
                </button>
              ) : (
                <>
                  <span className="text-xs text-status-out">Change {item.code} &rarr; {codeInput.trim()}?</span>
                  <button
                    onClick={saveCode}
                    disabled={codeBusy}
                    className="rounded-md bg-status-out px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setConfirmingCode(false);
                      setCodeInput(item.code);
                    }}
                    disabled={codeBusy}
                    className="rounded-md border border-card-border px-2 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            {codeError && <p className="mt-1 text-xs text-status-out">{codeError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-md border border-card-border px-3 py-2 text-sm" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="rounded-md border border-card-border px-3 py-2 text-sm" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Price" className="rounded-md border border-card-border px-3 py-2 text-sm" />
            <input
              value={yieldServings}
              onChange={(e) => setYieldServings(e.target.value)}
              type="number"
              min={1}
              step="1"
              placeholder="Yield (servings)"
              title="How many servings one order of this recipe actually produces"
              className="rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Packaging type</p>
            <p className="mt-1 text-xs text-navy-600">
              Drives what a takeaway order of this item pulls from stock (a lidded box or glass), and whether it gets a straw. See
              /admin/inventory&rsquo;s Consumables section.
            </p>
            <select
              value={packagingType}
              onChange={(e) => setPackagingType(e.target.value as typeof packagingType)}
              className="mt-2 rounded-md border border-card-border px-3 py-2 text-sm"
            >
              {PACKAGING_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Description</p>
            <p className="mt-1 text-xs text-navy-600">Shown to customers on the ordering menu, under the item name.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this item, and why would someone want to try it?"
              className="mt-2 w-full rounded-md border border-card-border px-3 py-2 text-sm"
            />
          </div>

          <button onClick={saveDetails} disabled={busy} className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            Save details
          </button>

          <ImageCropUpload code={item.code} currentImageUrl={imageUrl} onSaved={setImageUrl} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Ingredients used per order</p>
            <ul className="mt-2 space-y-1">
              {item.ingredients.length === 0 && <li className="text-sm text-navy-500">No ingredients linked yet.</li>}
              {item.ingredients.map((l) => (
                <LinkedIngredientRow
                  key={l.ingredientId}
                  itemCode={item.code}
                  link={l}
                  busy={busy}
                  onChanged={onChanged}
                  onRemove={() => removeLink(l.ingredientId)}
                />
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

          <div className="border-t border-card-border pt-4">
            {confirmingDelete ? (
              <div className="max-w-[360px] rounded-md border border-status-out/40 bg-red-50 p-2.5">
                <p className="text-xs font-semibold text-status-out">Delete {item.name}?</p>
                <p className="mt-1 text-xs text-navy-700">
                  This removes its recipe links and unlinks it from historical sales. Past orders and receipts that
                  included it are unaffected. This can&rsquo;t be undone.
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
              <button onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-status-out hover:underline">
                Delete item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuClient({ initialItems, ingredients }: { initialItems: MenuItemAdminView[]; ingredients: Ingredient[] }) {
  const [items] = useState(initialItems);
  const byCategory = useMemo(() => {
    const map = new Map<string, MenuItemAdminView[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [items]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newPackagingType, setNewPackagingType] = useState<MenuItem["packagingType"]>("food");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    window.location.reload();
  }

  async function reorderWithinCategory(categoryItems: MenuItemAdminView[], draggedCode: string, targetCode: string) {
    const codes = categoryItems.map((i) => i.code);
    const fromIdx = codes.indexOf(draggedCode);
    const toIdx = codes.indexOf(targetCode);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const reordered = [...codes];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedCode);

    try {
      await fetch("/api/menu/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedCodes: reordered }),
      });
    } finally {
      window.location.reload();
    }
  }

  async function addItem() {
    if (!newCode.trim() || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim(),
          name: newName.trim(),
          category: newCategory.trim() || "Other",
          price: Number(newPrice) || 0,
          active: true,
          packagingType: newPackagingType,
        }),
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
      <p className="text-xs text-navy-600">
        Drag the <span aria-hidden="true">☰</span> handle on the left of an item to reorder it within its category — that order is what customers see on the QR menu too.
      </p>
      <div className="space-y-8">
        {byCategory.map(([category, categoryItems]) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-600">{category}</h2>
            <div className="space-y-4">
              {categoryItems.map((item) => (
                <DraggableItem
                  key={item.code}
                  item={item}
                  ingredients={ingredients}
                  onChanged={refresh}
                  onDropReorder={(draggedCode, targetCode) => reorderWithinCategory(categoryItems, draggedCode, targetCode)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-950">Add a new menu item</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code (CT007)" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" placeholder="Price" className="rounded-md border border-card-border px-3 py-2 text-sm" />
          <select
            value={newPackagingType}
            onChange={(e) => setNewPackagingType(e.target.value as MenuItem["packagingType"])}
            className="rounded-md border border-card-border px-3 py-2 text-sm"
          >
            {PACKAGING_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
