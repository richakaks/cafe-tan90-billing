import { db } from "./supabase";
import { computeAvailability } from "./stock";
import type {
  CartItem,
  Ingredient,
  MenuItemAdminView,
  MenuItemIngredientLink,
  MenuItemWithAvailability,
  OrderItemRow,
  OrderRow,
  PlacedOrder,
  Seat,
} from "./types";

export class OrderError extends Error {
  code: "empty_order" | "invalid_seat" | "invalid_item" | "unknown_item" | "inactive_item" | "out_of_stock" | "unknown";
  detail?: string;

  constructor(rawMessage: string) {
    super(rawMessage);
    const [code, detail] = rawMessage.split(":").map((s) => s.trim());
    const known = ["empty_order", "invalid_seat", "invalid_item", "unknown_item", "inactive_item", "out_of_stock"];
    this.code = (known.includes(code) ? code : "unknown") as OrderError["code"];
    this.detail = detail;
  }

  get friendlyMessage(): string {
    switch (this.code) {
      case "empty_order":
        return "Your basket is empty.";
      case "invalid_seat":
        return "This table/seat link looks invalid. Please scan the QR code again.";
      case "out_of_stock":
        return `Sorry, we just ran out of: ${this.detail ?? "an item in your order"}. Please remove it and try again.`;
      case "unknown_item":
      case "inactive_item":
        return "One of the items in your basket is no longer available. Please refresh the menu.";
      default:
        return "Something went wrong placing your order. Please try again.";
    }
  }
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export async function getSeats(): Promise<Seat[]> {
  const { data, error } = await db().from("seats").select("id, label, kind").order("id");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, kind: r.kind }));
}

export async function getSeat(id: string): Promise<Seat | null> {
  const { data, error } = await db().from("seats").select("id, label, kind").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, label: data.label, kind: data.kind } : null;
}

// ---------------------------------------------------------------------------
// Customer menu
// ---------------------------------------------------------------------------

export async function getMenuForCustomer(): Promise<MenuItemWithAvailability[]> {
  const [{ data: items, error: itemsErr }, { data: ingredients, error: ingErr }, { data: links, error: linkErr }] =
    await Promise.all([
      db().from("menu_items").select("code, name, category, price, active").eq("active", true).order("category").order("name"),
      db().from("ingredients").select("id, name, unit, current_stock, low_stock_threshold"),
      db().from("menu_item_ingredients").select("menu_item_code, ingredient_id, qty_per_order"),
    ]);

  if (itemsErr) throw itemsErr;
  if (ingErr) throw ingErr;
  if (linkErr) throw linkErr;

  const ingredientsById = new Map<string, Ingredient>(
    (ingredients ?? []).map((i) => [
      i.id,
      { id: i.id, name: i.name, unit: i.unit, currentStock: Number(i.current_stock), lowStockThreshold: Number(i.low_stock_threshold) },
    ])
  );

  const linkList: MenuItemIngredientLink[] = (links ?? []).map((l) => ({
    menuItemCode: l.menu_item_code,
    ingredientId: l.ingredient_id,
    qtyPerOrder: Number(l.qty_per_order),
  }));

  return (items ?? []).map((item) => ({
    code: item.code,
    name: item.name,
    category: item.category,
    price: Number(item.price),
    active: item.active,
    status: computeAvailability(item.code, linkList, ingredientsById),
  }));
}

// ---------------------------------------------------------------------------
// Placing orders
// ---------------------------------------------------------------------------

export async function placeOrder(seatId: string, items: CartItem[]): Promise<PlacedOrder> {
  const { data, error } = await db().rpc("place_order", {
    p_seat_id: seatId,
    p_items: items,
  });

  if (error) throw new OrderError(error.message);

  return {
    orderId: data.order_id,
    dailyOrderNumber: data.daily_order_number,
    seatId: data.seat_id,
    orderDate: data.order_date,
    items: data.items,
    total: Number(data.total),
  };
}

// ---------------------------------------------------------------------------
// Serving screen
// ---------------------------------------------------------------------------

export async function getOpenOrders(): Promise<OrderRow[]> {
  const { data, error } = await db()
    .from("orders")
    .select("id, daily_order_number, order_date, seat_id, status, created_at, order_items(id, menu_item_code, item_name, qty, price_at_order)")
    .eq("status", "placed")
    .order("seat_id")
    .order("created_at");

  if (error) throw error;

  return (data ?? []).map((o) => ({
    id: o.id,
    dailyOrderNumber: o.daily_order_number,
    orderDate: o.order_date,
    seatId: o.seat_id,
    status: o.status,
    createdAt: o.created_at,
    items: (o.order_items ?? []).map(
      (it: { id: number; menu_item_code: string; item_name: string; qty: number; price_at_order: number }): OrderItemRow => ({
        id: it.id,
        menuItemCode: it.menu_item_code,
        itemName: it.item_name,
        qty: it.qty,
        priceAtOrder: Number(it.price_at_order),
      })
    ),
  }));
}

export async function markOrderServed(orderId: string): Promise<void> {
  const { error } = await db().from("orders").update({ status: "served" }).eq("id", orderId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Inventory admin
// ---------------------------------------------------------------------------

export async function getIngredients(): Promise<Ingredient[]> {
  const { data, error } = await db()
    .from("ingredients")
    .select("id, name, unit, current_stock, low_stock_threshold")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    currentStock: Number(i.current_stock),
    lowStockThreshold: Number(i.low_stock_threshold),
  }));
}

export async function createIngredient(name: string, unit: string, currentStock: number, lowStockThreshold: number): Promise<void> {
  const { error } = await db().from("ingredients").insert({ name, unit, current_stock: currentStock, low_stock_threshold: lowStockThreshold });
  if (error) throw error;
}

export async function adjustIngredientStock(id: string, delta: number): Promise<void> {
  const { data, error: readErr } = await db().from("ingredients").select("current_stock").eq("id", id).single();
  if (readErr) throw readErr;
  const next = Math.max(0, Number(data.current_stock) + delta);
  const { error } = await db().from("ingredients").update({ current_stock: next }).eq("id", id);
  if (error) throw error;
}

export async function updateIngredientThreshold(id: string, lowStockThreshold: number): Promise<void> {
  const { error } = await db().from("ingredients").update({ low_stock_threshold: lowStockThreshold }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Menu admin
// ---------------------------------------------------------------------------

export async function getMenuItemsAdmin(): Promise<MenuItemAdminView[]> {
  const [{ data: items, error: itemsErr }, { data: links, error: linkErr }, { data: ingredients, error: ingErr }] = await Promise.all([
    db().from("menu_items").select("code, name, category, price, active").order("category").order("name"),
    db().from("menu_item_ingredients").select("menu_item_code, ingredient_id, qty_per_order"),
    db().from("ingredients").select("id, name, unit"),
  ]);
  if (itemsErr) throw itemsErr;
  if (linkErr) throw linkErr;
  if (ingErr) throw ingErr;

  const ingredientsById = new Map((ingredients ?? []).map((i) => [i.id, i]));

  return (items ?? []).map((item) => ({
    code: item.code,
    name: item.name,
    category: item.category,
    price: Number(item.price),
    active: item.active,
    ingredients: (links ?? [])
      .filter((l) => l.menu_item_code === item.code)
      .map((l) => {
        const ing = ingredientsById.get(l.ingredient_id);
        return {
          ingredientId: l.ingredient_id,
          ingredientName: ing?.name ?? "(unknown)",
          unit: ing?.unit ?? "",
          qtyPerOrder: Number(l.qty_per_order),
        };
      }),
  }));
}

export async function upsertMenuItem(item: { code: string; name: string; category: string; price: number; active: boolean }): Promise<void> {
  const { error } = await db().from("menu_items").upsert(item);
  if (error) throw error;
}

export async function setMenuItemActive(code: string, active: boolean): Promise<void> {
  const { error } = await db().from("menu_items").update({ active }).eq("code", code);
  if (error) throw error;
}

export async function setMenuItemIngredient(menuItemCode: string, ingredientId: string, qtyPerOrder: number): Promise<void> {
  const { error } = await db()
    .from("menu_item_ingredients")
    .upsert({ menu_item_code: menuItemCode, ingredient_id: ingredientId, qty_per_order: qtyPerOrder });
  if (error) throw error;
}

export async function removeMenuItemIngredient(menuItemCode: string, ingredientId: string): Promise<void> {
  const { error } = await db().from("menu_item_ingredients").delete().eq("menu_item_code", menuItemCode).eq("ingredient_id", ingredientId);
  if (error) throw error;
}
