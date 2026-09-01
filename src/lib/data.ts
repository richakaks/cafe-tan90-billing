import { db } from "./supabase";
import { computeAvailability } from "./stock";
import type {
  CartItem,
  CouponBatch,
  Ingredient,
  ItemPair,
  ItemRanking,
  MenuItemAdminView,
  MenuItemIngredientLink,
  MenuItemWithAvailability,
  OrderItemRow,
  OrderRow,
  PlacedOrder,
  PlacedPreOrder,
  SalesAnalytics,
  Seat,
} from "./types";

export class OrderError extends Error {
  code:
    | "empty_order"
    | "invalid_seat"
    | "invalid_item"
    | "unknown_item"
    | "inactive_item"
    | "out_of_stock"
    | "missing_requested_date"
    | "unknown";
  detail?: string;

  constructor(rawMessage: string) {
    super(rawMessage);
    const [code, detail] = rawMessage.split(":").map((s) => s.trim());
    const known = [
      "empty_order",
      "invalid_seat",
      "invalid_item",
      "unknown_item",
      "inactive_item",
      "out_of_stock",
      "missing_requested_date",
    ];
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
      case "missing_requested_date":
        return "Please choose a date for your pre-order.";
      default:
        return "Something went wrong placing your order. Please try again.";
    }
  }
}

export class CouponError extends Error {
  code: "unknown_coupon" | "coupon_already_redeemed" | "order_already_has_coupon" | "unknown";

  constructor(rawMessage: string) {
    super(rawMessage);
    const known = ["unknown_coupon", "coupon_already_redeemed", "order_already_has_coupon"];
    this.code = (known.includes(rawMessage) ? rawMessage : "unknown") as CouponError["code"];
  }

  get friendlyMessage(): string {
    switch (this.code) {
      case "unknown_coupon":
        return "That coupon code isn't in the system.";
      case "coupon_already_redeemed":
        return "That coupon has already been used.";
      case "order_already_has_coupon":
        return "This order already has a coupon applied.";
      default:
        return "Couldn't apply that coupon. Please try again.";
    }
  }
}

export class FulfillError extends Error {
  code: "unknown_order" | "not_a_pre_order" | "already_fulfilled" | "out_of_stock" | "unknown";
  detail?: string;

  constructor(rawMessage: string) {
    super(rawMessage);
    const [code, detail] = rawMessage.split(":").map((s) => s.trim());
    const known = ["unknown_order", "not_a_pre_order", "already_fulfilled", "out_of_stock"];
    this.code = (known.includes(code) ? code : "unknown") as FulfillError["code"];
    this.detail = detail;
  }

  get friendlyMessage(): string {
    switch (this.code) {
      case "already_fulfilled":
        return "This pre-order has already been fulfilled.";
      case "out_of_stock":
        return `Can't fulfill yet — out of: ${this.detail ?? "an ingredient"}.`;
      default:
        return "Couldn't fulfill this pre-order. Please try again.";
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

export async function placePreOrder(items: CartItem[], requestedDate: string, requestedTime: string | null): Promise<PlacedPreOrder> {
  const { data, error } = await db().rpc("place_pre_order", {
    p_items: items,
    p_requested_date: requestedDate,
    p_requested_time: requestedTime,
  });

  if (error) throw new OrderError(error.message);

  return {
    orderId: data.order_id,
    requestedDate: data.requested_date,
    requestedTime: data.requested_time,
    items: data.items,
    total: Number(data.total),
  };
}

// ---------------------------------------------------------------------------
// Serving screen
// ---------------------------------------------------------------------------

const ORDER_ROW_SELECT =
  "id, daily_order_number, order_date, seat_id, status, order_type, requested_date, requested_time, coupon_code, discount_amount, created_at, order_items(id, menu_item_code, item_name, qty, price_at_order)";

type RawOrderRow = {
  id: string;
  daily_order_number: number | null;
  order_date: string | null;
  seat_id: string | null;
  status: string;
  order_type: string;
  requested_date: string | null;
  requested_time: string | null;
  coupon_code: string | null;
  discount_amount: number;
  created_at: string;
  order_items:
    | { id: number; menu_item_code: string; item_name: string; qty: number; price_at_order: number }[]
    | null;
};

function mapOrderRow(o: RawOrderRow): OrderRow {
  return {
    id: o.id,
    dailyOrderNumber: o.daily_order_number,
    orderDate: o.order_date,
    seatId: o.seat_id,
    status: o.status as OrderRow["status"],
    orderType: o.order_type as OrderRow["orderType"],
    requestedDate: o.requested_date,
    requestedTime: o.requested_time,
    couponCode: o.coupon_code,
    discountAmount: Number(o.discount_amount),
    createdAt: o.created_at,
    items: (o.order_items ?? []).map(
      (it): OrderItemRow => ({
        id: it.id,
        menuItemCode: it.menu_item_code,
        itemName: it.item_name,
        qty: it.qty,
        priceAtOrder: Number(it.price_at_order),
      })
    ),
  };
}

export async function getOpenOrders(): Promise<OrderRow[]> {
  const { data, error } = await db()
    .from("orders")
    .select(ORDER_ROW_SELECT)
    .eq("status", "placed")
    .order("seat_id")
    .order("created_at");

  if (error) throw error;
  return (data ?? []).map((o) => mapOrderRow(o as unknown as RawOrderRow));
}

export async function getPendingPreOrders(): Promise<OrderRow[]> {
  const { data, error } = await db()
    .from("orders")
    .select(ORDER_ROW_SELECT)
    .eq("status", "pending_pickup")
    .order("requested_date")
    .order("requested_time");

  if (error) throw error;
  return (data ?? []).map((o) => mapOrderRow(o as unknown as RawOrderRow));
}

export async function markOrderServed(orderId: string): Promise<void> {
  const { error } = await db().from("orders").update({ status: "served" }).eq("id", orderId);
  if (error) throw error;
}

export async function fulfillPreOrder(orderId: string): Promise<void> {
  const { error } = await db().rpc("fulfill_pre_order", { p_order_id: orderId });
  if (error) throw new FulfillError(error.message);
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function redeemCoupon(orderId: string, couponCode: string): Promise<void> {
  const { error } = await db().rpc("redeem_coupon", { p_order_id: orderId, p_coupon_code: couponCode });
  if (error) throw new CouponError(error.message);
}

export async function createCouponBatch(
  buyerName: string,
  couponValue: number,
  codes: string[],
  totalCollected: number
): Promise<void> {
  const uniqueCodes = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
  if (uniqueCodes.length === 0) throw new Error("No coupon codes given.");

  const { data: batch, error: batchErr } = await db()
    .from("coupon_batches")
    .insert({ buyer_name: buyerName, coupon_value: couponValue, quantity: uniqueCodes.length, total_collected: totalCollected })
    .select("id")
    .single();
  if (batchErr) throw batchErr;

  const { error: couponsErr } = await db()
    .from("coupons")
    .insert(uniqueCodes.map((code) => ({ code, batch_id: batch.id, value: couponValue })));
  if (couponsErr) throw couponsErr;
}

export async function getCouponBatches(): Promise<CouponBatch[]> {
  const [{ data: batches, error: batchErr }, { data: coupons, error: couponErr }] = await Promise.all([
    db().from("coupon_batches").select("id, buyer_name, coupon_value, quantity, total_collected, sold_at").order("sold_at", { ascending: false }),
    db().from("coupons").select("batch_id, redeemed"),
  ]);
  if (batchErr) throw batchErr;
  if (couponErr) throw couponErr;

  const redeemedCounts = new Map<string, number>();
  for (const c of coupons ?? []) {
    if (c.redeemed) redeemedCounts.set(c.batch_id, (redeemedCounts.get(c.batch_id) ?? 0) + 1);
  }

  return (batches ?? []).map((b) => ({
    id: b.id,
    buyerName: b.buyer_name,
    couponValue: Number(b.coupon_value),
    quantity: b.quantity,
    totalCollected: Number(b.total_collected),
    soldAt: b.sold_at,
    redeemedCount: redeemedCounts.get(b.id) ?? 0,
  }));
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

// ---------------------------------------------------------------------------
// Sales & analytics
// ---------------------------------------------------------------------------

// Orders count as "sales" once they're real (placed or served) — a pending
// pre-order hasn't happened yet (order_date is null until fulfillment, so it
// wouldn't match a date range anyway) and isn't counted.
export async function getSalesAnalytics(from: string, to: string): Promise<SalesAnalytics> {
  const [{ data: orders, error: ordersErr }, { data: menuItems, error: menuErr }] = await Promise.all([
    db()
      .from("orders")
      .select("id, order_date, discount_amount, order_items(menu_item_code, item_name, qty, price_at_order)")
      .in("status", ["placed", "served"])
      .gte("order_date", from)
      .lte("order_date", to),
    db().from("menu_items").select("code, category"),
  ]);
  if (ordersErr) throw ordersErr;
  if (menuErr) throw menuErr;

  const categoryByCode = new Map((menuItems ?? []).map((m) => [m.code, m.category]));

  const dailyMap = new Map<string, { orderCount: number; revenue: number }>();
  const itemMap = new Map<string, ItemRanking>();
  const categoryMap = new Map<string, number>();
  const pairCounts = new Map<string, ItemPair>();
  let totalRevenue = 0;

  type RawItem = { menu_item_code: string; item_name: string; qty: number; price_at_order: number };
  type RawOrder = { id: string; order_date: string | null; discount_amount: number; order_items: RawItem[] | null };

  for (const order of (orders ?? []) as unknown as RawOrder[]) {
    if (!order.order_date) continue;
    const items = order.order_items ?? [];
    const orderGross = items.reduce((sum, it) => sum + it.qty * Number(it.price_at_order), 0);
    const orderNet = Math.max(0, orderGross - Number(order.discount_amount));
    totalRevenue += orderNet;

    const day = dailyMap.get(order.order_date) ?? { orderCount: 0, revenue: 0 };
    day.orderCount += 1;
    day.revenue += orderNet;
    dailyMap.set(order.order_date, day);

    for (const it of items) {
      const existing = itemMap.get(it.menu_item_code) ?? { code: it.menu_item_code, name: it.item_name, qty: 0, revenue: 0 };
      existing.qty += it.qty;
      existing.revenue += it.qty * Number(it.price_at_order);
      itemMap.set(it.menu_item_code, existing);

      const category = categoryByCode.get(it.menu_item_code) ?? "Other";
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + it.qty * Number(it.price_at_order));
    }

    // Pairing: every unique combination of distinct items within this one order.
    const distinctCodes = Array.from(new Set(items.map((it) => it.menu_item_code))).sort();
    for (let i = 0; i < distinctCodes.length; i++) {
      for (let j = i + 1; j < distinctCodes.length; j++) {
        const key = `${distinctCodes[i]}|${distinctCodes[j]}`;
        const a = items.find((it) => it.menu_item_code === distinctCodes[i])!;
        const b = items.find((it) => it.menu_item_code === distinctCodes[j])!;
        const existing = pairCounts.get(key) ?? { codeA: a.menu_item_code, nameA: a.item_name, codeB: b.menu_item_code, nameB: b.item_name, count: 0 };
        existing.count += 1;
        pairCounts.set(key, existing);
      }
    }
  }

  const rankedItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);

  return {
    from,
    to,
    totalRevenue,
    totalOrders: Array.from(dailyMap.values()).reduce((sum, d) => sum + d.orderCount, 0),
    dailyTotals: Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, orderCount: v.orderCount, revenue: v.revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    bestsellers: rankedItems.slice(0, 10),
    leastSellers: [...rankedItems].reverse().slice(0, 10),
    categoryTotals: Array.from(categoryMap.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    topPairs: Array.from(pairCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}
