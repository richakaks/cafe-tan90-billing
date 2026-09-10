"use client";

import Link from "next/link";
import { useState } from "react";
import type { Ingredient, IngredientKind, LastRestockPrice, PrimaryRecipeLink, StockAdjustmentRow } from "@/lib/types";
import { ingredientAlertStatus } from "@/lib/stock";
import { RangeResetOrdersButton, ResetButton } from "@/components/OrdersDangerZone";

// Round 22: one ingredient <-> menu-item recipe link, as seen from the
// ingredient side -- same shape data.ts's getIngredientRecipeLinks() returns
// per ingredient id.
type RecipeLink = { menuItemCode: string; menuItemName: string; qtyPerOrder: number; unitLabel: string | null };
type MenuItemOption = { code: string; name: string };

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
  const [kind, setKind] = useState<IngredientKind>(ingredient.kind);
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
      if (kind !== ingredient.kind) body.kind = kind;

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
      <div className="flex flex-wrap gap-3 text-xs text-navy-700">
        <label className="flex items-center gap-1">
          <input type="radio" checked={kind === "raw"} onChange={() => setKind("raw")} />
          Raw ingredient
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={kind === "batch_prep"} onChange={() => setKind("batch_prep")} />
          Batch prep
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={kind === "consumable"} onChange={() => setKind("consumable")} />
          Consumable
        </label>
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

// Round 22's "used in" editor, ingredient side: lets staff link/unlink/edit
// this ingredient's recipe links directly from /admin/inventory, instead of
// only from the menu item's own edit panel on /admin/menu. Reuses the exact
// same /api/menu/[code]/ingredients endpoints as that panel -- this is just
// a second UI driving the same setMenuItemIngredient()/removeMenuItemIngredient()
// data.ts functions, so the two screens can never drift out of sync.
function UsedInRow({
  ingredientId,
  ingredientUnit,
  link,
  busy,
  onChanged,
  onRemove,
}: {
  ingredientId: string;
  ingredientUnit: string;
  link: RecipeLink;
  busy: boolean;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const [qty, setQty] = useState(String(link.qtyPerOrder));
  const [unitLabel, setUnitLabel] = useState(link.unitLabel ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = Number(qty) !== link.qtyPerOrder || unitLabel !== (link.unitLabel ?? "");

  async function save() {
    const n = Number(qty);
    if (!n || n <= 0) return;
    setSaving(true);
    try {
      await fetch(`/api/menu/${link.menuItemCode}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId, qtyPerOrder: n, unitLabel: unitLabel.trim() || null }),
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  // Round 25 mobile fix: this row lives inside the Inventory table's fixed-
  // width Ingredient column (34% on desktop, easily under 150px on a phone
  // once the table's overflow-x-auto wrapper kicks in). With no wrap, the
  // name plus two inputs plus Save/Remove couldn't all fit and spilled past
  // the cell boundary into the neighboring column instead of clipping,
  // which is what read as "texts go over each other." flex-wrap lets the
  // controls drop to a second line instead of overflowing sideways, and
  // basis-full forces the item name onto its own line below `sm` so it
  // never has to share a cramped line with the inputs at all.
  return (
    <li className="flex flex-wrap items-center gap-1.5 text-xs text-navy-800">
      <span className="min-w-0 basis-full truncate sm:basis-auto sm:flex-1">{link.menuItemName}</span>
      <input
        type="number"
        min={0}
        step="any"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="w-14 shrink-0 rounded-md border border-card-border px-1.5 py-0.5 text-xs"
      />
      <input
        value={unitLabel}
        onChange={(e) => setUnitLabel(e.target.value)}
        placeholder={ingredientUnit}
        title="Unit label shown here (display only -- stock still deducts using this ingredient's real unit)"
        className="w-12 shrink-0 rounded-md border border-card-border px-1 py-0.5 text-xs"
      />
      {dirty && (
        <button onClick={save} disabled={busy || saving} className="shrink-0 font-medium text-status-good hover:underline">
          Save
        </button>
      )}
      <button onClick={onRemove} disabled={busy || saving} className="shrink-0 text-status-out hover:underline">
        Remove
      </button>
    </li>
  );
}

function UsedInEditor({
  ingredientId,
  ingredientUnit,
  links,
  menuItems,
  onChanged,
}: {
  ingredientId: string;
  ingredientUnit: string;
  links: RecipeLink[];
  menuItems: MenuItemOption[];
  onChanged: () => void;
}) {
  const [addCode, setAddCode] = useState("");
  const [addQty, setAddQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedCodes = new Set(links.map((l) => l.menuItemCode));
  const availableToLink = menuItems.filter((m) => !linkedCodes.has(m.code));

  async function addLink() {
    if (!addCode || !addQty || Number(addQty) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/menu/${addCode}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId, qtyPerOrder: Number(addQty) }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not link this menu item.");
        return;
      }
      setAddCode("");
      setAddQty("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(menuItemCode: string) {
    setBusy(true);
    try {
      await fetch(`/api/menu/${menuItemCode}/ingredients/${ingredientId}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-card-border bg-navy-50/60 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Used in which menu items</p>
      {links.length === 0 ? (
        <p className="mt-1 text-xs text-navy-500">Not linked to any menu item yet.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {links.map((l) => (
            <UsedInRow
              key={l.menuItemCode}
              ingredientId={ingredientId}
              ingredientUnit={ingredientUnit}
              link={l}
              busy={busy}
              onChanged={onChanged}
              onRemove={() => removeLink(l.menuItemCode)}
            />
          ))}
        </ul>
      )}
      {availableToLink.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <select
            value={addCode}
            onChange={(e) => setAddCode(e.target.value)}
            className="rounded-md border border-card-border px-1.5 py-1 text-xs"
          >
            <option value="">Add to menu item…</option>
            {availableToLink.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            type="number"
            min={0}
            step="any"
            placeholder="Qty per order"
            className="w-24 rounded-md border border-card-border px-1.5 py-1 text-xs"
          />
          <span className="text-xs text-navy-500">{ingredientUnit}</span>
          <button
            onClick={addLink}
            disabled={busy || !addCode}
            className="rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            Link
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-status-out">{error}</p>}
    </div>
  );
}

// Round 23: nested bill-of-materials -- lets staff record "I just prepped a
// batch of this primary" right from its Batch Prep row. Calls prep_batch(),
// which atomically deducts the primary's own raw ingredients (scaled to the
// entered batch qty) and credits that qty onto the primary's own stock --
// same all-or-nothing semantics as placing an order. The recipe preview
// below the qty input shows exactly what a batch will consume, scaled live
// as the qty is typed, so staff can catch a shortage before submitting (the
// server still enforces it either way via the out_of_stock error).
function PrepBatchControl({
  ingredient,
  recipe,
  onChanged,
}: {
  ingredient: Ingredient;
  recipe: PrimaryRecipeLink[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const n = Number(qty);
  const previewValid = qty.trim() !== "" && !Number.isNaN(n) && n > 0;

  async function prep() {
    if (!previewValid) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/inventory/${ingredient.id}/prep-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchQty: n }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not record this batch prep.");
        return;
      }
      setSuccess(`Prepped ${n} ${ingredient.unit} of ${ingredient.name} — stock updated.`);
      setQty("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-navy-700 underline decoration-dotted">
        {open ? "Hide prep a batch" : "Prep a batch"}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-card-border bg-navy-50/60 p-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Record a batch prep</p>
          {recipe.length === 0 ? (
            <p className="mt-1 text-xs text-navy-500">
              No raw-ingredient recipe on file for this primary yet — prepping a batch will only credit its own stock.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-0.5 text-xs text-navy-700">
              {recipe.map((r) => (
                <li key={r.rawIngredientId}>
                  {(previewValid ? r.qtyPerUnit * n : r.qtyPerUnit).toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                  {r.rawIngredientUnit} {r.rawIngredientName}
                  {!previewValid && <span className="text-navy-400"> per {ingredient.unit}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder="Batch qty"
              className="w-24 rounded-md border border-card-border px-1.5 py-1 text-xs"
            />
            <span className="text-xs text-navy-500">{ingredient.unit}</span>
            <button
              onClick={prep}
              disabled={busy || !previewValid}
              className="rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              Prep batch
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-status-out">{error}</p>}
          {success && <p className="mt-1 text-xs text-status-good">{success}</p>}
        </div>
      )}
    </>
  );
}

function Row({
  ingredient,
  lastRestock,
  recipeLinks,
  primaryRecipe,
  menuItems,
  onChanged,
  highlighted,
}: {
  ingredient: Ingredient;
  lastRestock?: LastRestockPrice;
  recipeLinks: RecipeLink[];
  primaryRecipe: PrimaryRecipeLink[];
  menuItems: MenuItemOption[];
  onChanged: () => void;
  highlighted?: boolean;
}) {
  const usedIn = recipeLinks.map((l) => l.menuItemName);
  const [showUsedIn, setShowUsedIn] = useState(false);
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
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
              <button onClick={() => setEditing(true)} className="text-xs font-medium text-navy-700 underline decoration-dotted">
                Edit
              </button>
              {!showUsedIn && (
                <button onClick={() => setShowUsedIn(true)} className="text-xs font-medium text-navy-700 underline decoration-dotted">
                  Manage used-in
                </button>
              )}
              <button onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-status-out underline decoration-dotted">
                Delete
              </button>
            </div>
            {ingredient.kind === "batch_prep" && (
              <div className="mt-2">
                <PrepBatchControl ingredient={ingredient} recipe={primaryRecipe} onChanged={onChanged} />
              </div>
            )}
            {showUsedIn && (
              <>
                <UsedInEditor
                  ingredientId={ingredient.id}
                  ingredientUnit={ingredient.unit}
                  links={recipeLinks}
                  menuItems={menuItems}
                  onChanged={onChanged}
                />
                <button
                  onClick={() => setShowUsedIn(false)}
                  className="mt-2 rounded-md border border-card-border px-2.5 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100"
                >
                  Done
                </button>
              </>
            )}
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
              className="whitespace-nowrap rounded-md bg-navy-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              + Restock
            </button>
            <button
              disabled={busy}
              onClick={() => restock(-1)}
              className="whitespace-nowrap rounded-md border border-card-border px-2 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
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
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-16 shrink-0 rounded-md border border-card-border px-2 py-1 text-sm"
          />
          <span className="shrink-0 whitespace-nowrap text-xs text-navy-600">{ingredient.unit}</span>
          <button
            disabled={busy}
            onClick={saveThreshold}
            className="shrink-0 whitespace-nowrap rounded-md border border-card-border px-2 py-1 text-xs font-medium text-navy-900 hover:bg-navy-100 disabled:opacity-50"
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
  recipeLinks,
  primaryRecipeLinks,
  menuItems,
}: {
  initialIngredients: Ingredient[];
  initialAdjustments: StockAdjustmentRow[];
  lastRestockPrices: Record<string, LastRestockPrice>;
  recipeLinks: Record<string, RecipeLink[]>;
  primaryRecipeLinks: Record<string, PrimaryRecipeLink[]>;
  menuItems: MenuItemOption[];
}) {
  const [ingredients] = useState(initialIngredients);
  const [adjustments] = useState(initialAdjustments);
  // Priority = how many menu items this ingredient is used in -- an
  // ingredient that's out of stock on a bestseller-heavy item is worth
  // restocking before a niche one, even if both are equally "out."
  // Ties (including two ingredients used in zero recipes) fall back to name.
  const lowOrOut = ingredients
    .filter((ing) => ingredientAlertStatus(ing) !== null)
    .sort((a, b) => (recipeLinks[b.id]?.length ?? 0) - (recipeLinks[a.id]?.length ?? 0) || a.name.localeCompare(b.name));
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  const [newKind, setNewKind] = useState<IngredientKind>("raw");
  // Round 23: link the new ingredient into one or more menu items' recipes
  // right at creation time, instead of only via "Manage used-in" after the
  // fact -- optional, one blank row by default. Round 25: multiple rows
  // instead of a single code/qty pair, so linking several menu items at
  // creation time doesn't require re-adding the ingredient from the list
  // and reopening "Manage used-in" for every item after the first.
  const [newLinks, setNewLinks] = useState<{ code: string; qty: string }[]>([{ code: "", qty: "" }]);
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
  // Owner asked for batch-prep items (keemas, base milks, concentrates —
  // things made ahead in a batch) split out from raw single ingredients, and
  // (Round 22) packaging consumables (straws, takeaway boxes/cups/glasses)
  // split out into their own third section too, rather than one long mixed
  // list.
  const batchPrepIngredients = visibleIngredients.filter((ing) => ing.kind === "batch_prep");
  const rawIngredients = visibleIngredients.filter((ing) => ing.kind === "raw");
  const consumableIngredients = visibleIngredients.filter((ing) => ing.kind === "consumable");

  function refresh() {
    window.location.reload();
  }

  // Shared table renderer for the Batch Prep / Raw Ingredients / Consumables
  // sections below -- all three need identical columns and Row behavior,
  // just a different slice of the (already search-filtered) ingredient list.
  function renderTable(items: Ingredient[], emptyLabel: string) {
    return (
      <div className="overflow-x-auto">
        {/* table-fixed + explicit column widths: a long "Used in" list on one
            row (e.g. an ingredient used in a dozen recipes) must NOT be able
            to steal width from the Restock/Use or Threshold columns on every
            other row -- with the browser's default auto layout, one cell's
            long content can do exactly that, which is what was squeezing the
            +Restock/-Use buttons on some rows but not others. Fixed layout
            makes every row share the same column widths regardless of any
            single cell's content; the overflow-x-auto wrapper above is a
            safety net for very narrow viewports now that the page itself is
            wide enough that the table normally fits without scrolling. */}
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-navy-600">
              <th className="w-[34%] pb-2">Ingredient</th>
              <th className="w-[12%] pb-2">Current stock</th>
              <th className="w-[32%] pb-2">Restock / use</th>
              <th className="w-[22%] pb-2">Low-stock threshold</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ing) => (
              <Row
                key={ing.id}
                ingredient={ing}
                lastRestock={lastRestockPrices[ing.id]}
                recipeLinks={recipeLinks[ing.id] ?? []}
                primaryRecipe={primaryRecipeLinks[ing.id] ?? []}
                menuItems={menuItems}
                onChanged={refresh}
                highlighted={highlightedId === ing.id}
              />
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-4 text-sm text-navy-600">{emptyLabel}</p>}
      </div>
    );
  }

  async function addIngredient() {
    if (!newName.trim() || !newUnit.trim()) return;
    // Only rows where a menu item was actually picked count as a real link
    // request -- a still-blank trailing row (or one the owner added and
    // then left empty) is silently ignored rather than treated as an error.
    const linkRows = newLinks.filter((l) => l.code);
    const invalidRow = linkRows.find((l) => !l.qty || Number(l.qty) <= 0);
    if (invalidRow) {
      setError("Enter a qty per order for every menu item you picked (or remove the row to skip linking it).");
      return;
    }
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
          kind: newKind,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not add ingredient.");
        return;
      }
      // Optional immediate recipe links, same endpoint the "used in" editor
      // and the menu-side editor already both use -- best-effort per row:
      // the ingredient itself is already created and saved at this point,
      // so one row failing doesn't roll anything back or block the rest --
      // every row is attempted, and any failures are reported together.
      if (linkRows.length > 0 && body.id) {
        const failures: string[] = [];
        for (const row of linkRows) {
          const linkRes = await fetch(`/api/menu/${row.code}/ingredients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ingredientId: body.id, qtyPerOrder: Number(row.qty) }),
          });
          if (!linkRes.ok) {
            const linkBody = await linkRes.json();
            const name = menuItems.find((m) => m.code === row.code)?.name ?? row.code;
            failures.push(`${name} (${linkBody.error ?? "unknown error"})`);
          }
        }
        if (failures.length > 0) {
          setError(`Ingredient added, but couldn't link it to: ${failures.join("; ")}.`);
          return;
        }
      }
      setNewName("");
      setNewBrand("");
      setNewUnit("");
      setNewStock("");
      setNewThreshold("");
      setNewKind("raw");
      setNewLinks([{ code: "", qty: "" }]);
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
    setNewKind("raw");
    setNewLinks([{ code: "", qty: "" }]);
    setError(null);
  }

  function updateNewLink(index: number, field: "code" | "qty", value: string) {
    setNewLinks((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addNewLinkRow() {
    setNewLinks((rows) => [...rows, { code: "", qty: "" }]);
  }

  function removeNewLinkRow(index: number) {
    setNewLinks((rows) => (rows.length === 1 ? [{ code: "", qty: "" }] : rows.filter((_, i) => i !== index)));
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
              const usedInCount = recipeLinks[ing.id]?.length ?? 0;
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
      </div>

      {/* Each section is its own card now (not one long list with a border
          between them) -- easier to tell where one ends and the next begins
          while scrolling. */}
      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-navy-950">Batch Prep</h2>
        {renderTable(batchPrepIngredients, query ? `No batch prep item matches “${query}”.` : "No batch prep items yet.")}
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-navy-950">Raw Ingredients</h2>
        {renderTable(rawIngredients, query ? `No raw ingredient matches “${query}”.` : "No raw ingredients yet.")}
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-navy-950">Consumables</h2>
        {renderTable(consumableIngredients, query ? `No consumable matches “${query}”.` : "No consumables yet.")}
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
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-600">Category</span>
            <div className="flex h-[38px] flex-wrap items-center gap-3 text-sm text-navy-800">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={newKind === "raw"} onChange={() => setNewKind("raw")} />
                Raw
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={newKind === "batch_prep"} onChange={() => setNewKind("batch_prep")} />
                Batch prep
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={newKind === "consumable"} onChange={() => setNewKind("consumable")} />
                Consumable
              </label>
            </div>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-navy-600">Used in (optional)</span>
            {/* Round 25: multiple rows -- each menu item this new ingredient
                goes into gets its own row, so linking it to several recipes
                doesn't require adding the ingredient, leaving, and coming
                back to "Manage used-in" for every item after the first. */}
            <div className="space-y-2">
              {newLinks.map((row, i) => {
                const pickedElsewhere = new Set(newLinks.filter((_, j) => j !== i).map((r) => r.code).filter(Boolean));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.code}
                      onChange={(e) => updateNewLink(i, "code", e.target.value)}
                      className="rounded-md border border-card-border px-3 py-2 text-sm"
                    >
                      <option value="">Not linked to a menu item yet…</option>
                      {menuItems
                        .filter((m) => m.code === row.code || !pickedElsewhere.has(m.code))
                        .map((m) => (
                          <option key={m.code} value={m.code}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                    {row.code && (
                      <>
                        <input
                          value={row.qty}
                          onChange={(e) => updateNewLink(i, "qty", e.target.value)}
                          type="number"
                          min={0}
                          step="any"
                          placeholder="Qty per order"
                          className="w-32 rounded-md border border-card-border px-3 py-2 text-sm"
                        />
                        <span className="text-xs text-navy-500">{newUnit.trim() || "unit"}</span>
                      </>
                    )}
                    {(row.code || newLinks.length > 1) && (
                      <button onClick={() => removeNewLinkRow(i)} className="text-xs font-medium text-status-out hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addNewLinkRow} className="mt-2 text-xs font-medium text-navy-700 underline decoration-dotted">
              + Add another menu item
            </button>
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
