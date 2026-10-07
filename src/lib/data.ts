import { db } from "./supabase";
import { computeAvailability, restockVerdict } from "./stock";
import { addDays, daysBetweenInclusive, enumerateDates, weekdayOf } from "./analyticsDates";
import type {
  CartItem,
  CouponBatch,
  Ingredient,
  ItemPair,
  ItemRanking,
  LastRestockPrice,
  MenuItem,
  MenuItemAdminView,
  MenuItemIngredientLink,
  MenuItemWithAvailability,
  OrderItemRow,
  OrderRow,
  PaymentMethod,
  PeriodTotals,
  PlacedOrder,
  PlacedPreOrder,
  PrimaryRecipeLink,
  RestockSignal,
  SalesAnalytics,
  Seat,
  StockAdjustmentRow,
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
    | "invalid_fulfillment_type"
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
      "invalid_fulfillment_type",
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
      case "invalid_fulfillment_type":
        return "Please choose Dine In or Takeaway for each item.";
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

// Round 23: errors from prep_batch() -- recording a batch prep of a primary
// (nested bill-of-materials deduction of its own raw ingredients). Same
// "code: detail" convention as OrderError/FulfillError above.
export class PrepBatchError extends Error {
  code: "invalid_batch_qty" | "unknown_primary" | "out_of_stock" | "unknown";
  detail?: string;

  constructor(rawMessage: string) {
    super(rawMessage);
    const [code, detail] = rawMessage.split(":").map((s) => s.trim());
    const known = ["invalid_batch_qty", "unknown_primary", "out_of_stock"];
    this.code = (known.includes(code) ? code : "unknown") as PrepBatchError["code"];
    this.detail = detail;
  }

  get friendlyMessage(): string {
    switch (this.code) {
      case "invalid_batch_qty":
        return "Enter a batch quantity greater than 0.";
      case "unknown_primary":
        return "That ingredient couldn't be found.";
      case "out_of_stock":
        return `Not enough stock to prep this batch -- short on: ${this.detail ?? "a raw ingredient"}.`;
      default:
        return "Couldn't record this batch prep. Please try again.";
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

// Round 22: lightweight code/name list for the ingredient-side "used in"
// editor's menu-item dropdown on /admin/inventory -- deliberately not
// getMenuItemsAdmin() (that also joins every recipe link + ingredient row
// for every item, which this dropdown doesn't need).
export async function getMenuItemsForDropdown(): Promise<{ code: string; name: string }[]> {
  const { data, error } = await db().from("menu_items").select("code, name").order("sort_order");
  if (error) throw error;
  return (data ?? []).map((m) => ({ code: m.code, name: m.name }));
}

export async function getMenuForCustomer(): Promise<MenuItemWithAvailability[]> {
  const [{ data: items, error: itemsErr }, { data: ingredients, error: ingErr }, { data: links, error: linkErr }, { data: qrSwitch }] =
    await Promise.all([
      db()
        .from("menu_items")
        .select("code, name, category, price, active, description, image_url, packaging_type")
        .eq("active", true)
        .order("sort_order"),
      db().from("ingredients").select("id, name, unit, current_stock, low_stock_threshold"),
      db().from("menu_item_ingredients").select("menu_item_code, ingredient_id, qty_per_order"),
      // Round 38: with "QR orders take stock off" turned off, stock isn't
      // checked, so nothing is shown as sold out.
      db().from("app_settings").select("value").eq("key", "sales_deduct_qr").maybeSingle(),
    ]);
  const qrStockOn = (qrSwitch?.value as { on?: boolean } | null)?.on ?? true;

  if (itemsErr) throw itemsErr;
  if (ingErr) throw ingErr;
  if (linkErr) throw linkErr;

  // brand/kind aren't selected/needed here -- this map only feeds
  // stock-availability math for the customer menu, so they're stubbed
  // rather than fetched.
  const ingredientsById = new Map<string, Ingredient>(
    (ingredients ?? []).map((i) => [
      i.id,
      {
        id: i.id,
        name: i.name,
        brand: null,
        unit: i.unit,
        currentStock: Number(i.current_stock),
        lowStockThreshold: Number(i.low_stock_threshold),
        kind: "raw",
      },
    ])
  );

  // unitLabel isn't selected/needed here -- this list only feeds
  // stock-availability math, which never looks at it -- so it's stubbed
  // rather than fetched, same as ingredientsById's brand/kind above.
  const linkList: MenuItemIngredientLink[] = (links ?? []).map((l) => ({
    menuItemCode: l.menu_item_code,
    ingredientId: l.ingredient_id,
    qtyPerOrder: Number(l.qty_per_order),
    unitLabel: null,
  }));

  return (items ?? []).map((item) => ({
    code: item.code,
    name: item.name,
    category: item.category,
    price: Number(item.price),
    active: item.active,
    description: item.description ?? null,
    imageUrl: item.image_url ?? null,
    packagingType: item.packaging_type as MenuItem["packagingType"],
    status: qrStockOn ? computeAvailability(item.code, linkList, ingredientsById) : "in_stock",
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
  "id, daily_order_number, order_date, seat_id, status, order_type, requested_date, requested_time, coupon_code, discount_amount, payment_method, created_at, source, customer_label, manual_discount_pct, manual_discount_amount, discount_note, order_items(id, menu_item_code, item_name, qty, price_at_order, fulfillment_type, note), order_payments(method, amount), order_coupons(id, coupon_code, amount, attempted_code), is_trial";

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
  payment_method: string | null;
  created_at: string;
  source: string | null;
  customer_label: string | null;
  order_items:
    | { id: number; menu_item_code: string; item_name: string; qty: number; price_at_order: number; fulfillment_type: string; note: string | null }[]
    | null;
  order_payments: { method: string; amount: number }[] | null;
  order_coupons: { id: number; coupon_code: string | null; amount: number; attempted_code: string | null }[] | null;
  manual_discount_pct: number | null;
  manual_discount_amount: number | null;
  discount_note: string | null;
  is_trial: boolean | null;
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
    paymentMethod: (o.payment_method as OrderRow["paymentMethod"]) ?? null,
    createdAt: o.created_at,
    items: (o.order_items ?? []).map(
      (it): OrderItemRow => ({
        id: it.id,
        menuItemCode: it.menu_item_code,
        itemName: it.item_name,
        qty: it.qty,
        priceAtOrder: Number(it.price_at_order),
        fulfillmentType: it.fulfillment_type as OrderItemRow["fulfillmentType"],
        note: it.note ?? null,
      })
    ),
    source: o.source === "counter" ? "counter" : "qr",
    customerLabel: o.customer_label ?? null,
    amountPaid: (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
    isTrial: !!o.is_trial,
    cashPaid: (o.order_payments ?? []).filter((p) => p.method === "cash").reduce((sum, p) => sum + Number(p.amount), 0),
    onlinePaid: (o.order_payments ?? []).filter((p) => p.method === "online").reduce((sum, p) => sum + Number(p.amount), 0),
    coupons: (o.order_coupons ?? [])
      .sort((a, b) => a.id - b.id)
      .map((c) => ({ id: c.id, code: c.coupon_code, amount: Number(c.amount), attemptedCode: c.attempted_code })),
    manualDiscountPct: o.manual_discount_pct === null ? null : Number(o.manual_discount_pct),
    manualDiscountAmount: Number(o.manual_discount_amount ?? 0),
    discountNote: o.discount_note ?? null,
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

// Round 32: via mark_order_served() -- a counter order that's already fully
// paid goes straight to 'paid' instead of waiting on /billing.
export async function markOrderServed(orderId: string): Promise<void> {
  const { error } = await db().rpc("mark_order_served", { p_order_id: orderId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

// Orders that have been served but not yet paid — the /billing screen's
// worklist. Grouped by seat client-side, same as getOpenOrders(), so a table
// that ordered more than once in a visit shows all its unpaid orders together.
export async function getServedOrders(): Promise<OrderRow[]> {
  const { data, error } = await db()
    .from("orders")
    .select(ORDER_ROW_SELECT)
    .eq("status", "served")
    .order("seat_id")
    .order("created_at");

  if (error) throw error;
  return (data ?? []).map((o) => mapOrderRow(o as unknown as RawOrderRow));
}

// Marks one or several orders paid at once (staff's choice — one order at a
// time, or a whole table's tab together). Only flips orders that are
// currently 'served', so this can't accidentally "pay" something still
// cooking or already paid. paymentMethod is required (Round 17) — a
// combined bill is one real-world transaction, so every order in the same
// call gets the same method.
// Round 32: via pay_orders(), which also records a payment row for whatever
// is still owed on each order (so the cash drawer and the counter's daily
// summary see billing payments too) -- a counter order that was partly paid
// at the counter only gets the remainder recorded.
export async function markOrdersPaid(orderIds: string[], paymentMethod: PaymentMethod): Promise<void> {
  if (orderIds.length === 0) return;
  const { error } = await db().rpc("pay_orders", { p_order_ids: orderIds, p_method: paymentMethod, p_staff_id: null });
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
  totalCollected: number,
  // Round 26: sold_at is now settable at entry time (for backdating a batch
  // entered late), and paid/collected start false by default -- entering a
  // batch on the site doesn't mean it's been paid for or picked up yet.
  soldAt?: string,
  paid: boolean = false,
  collected: boolean = false,
  // Round 35: optional -- from this date the batch's coupons stop working.
  expiresOn: string | null = null
): Promise<void> {
  const uniqueCodes = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
  if (uniqueCodes.length === 0) throw new Error("No coupon codes given.");

  const insertRow: Record<string, unknown> = {
    buyer_name: buyerName,
    coupon_value: couponValue,
    quantity: uniqueCodes.length,
    total_collected: totalCollected,
    paid,
    collected,
    expires_on: expiresOn,
  };
  if (soldAt) insertRow.sold_at = soldAt;

  const { data: batch, error: batchErr } = await db().from("coupon_batches").insert(insertRow).select("id").single();
  if (batchErr) throw batchErr;

  const { error: couponsErr } = await db()
    .from("coupons")
    .insert(uniqueCodes.map((code) => ({ code, batch_id: batch.id, value: couponValue })));
  if (couponsErr) throw couponsErr;
}

// Round 26: lets the admin coupons page correct a batch's sale date after
// the fact (it's often entered days after the real sale), and flip paid /
// collected independently as those actually happen -- neither is inferred
// from the other or from redemption.
export async function updateCouponBatch(
  id: string,
  updates: {
    soldAt?: string;
    paid?: boolean;
    collected?: boolean;
    // Round 26 follow-up: buyer/value/total are entered once at creation
    // with no way to fix a typo or a misheard amount afterward -- these
    // three are now editable the same way, via the row's "Edit" button.
    buyerName?: string;
    couponValue?: number;
    totalCollected?: number;
    // Round 35: null clears the expiry.
    expiresOn?: string | null;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.soldAt) row.sold_at = updates.soldAt;
  if (updates.paid !== undefined) row.paid = updates.paid;
  if (updates.collected !== undefined) row.collected = updates.collected;
  if (updates.buyerName !== undefined) row.buyer_name = updates.buyerName;
  if (updates.couponValue !== undefined) row.coupon_value = updates.couponValue;
  if (updates.totalCollected !== undefined) row.total_collected = updates.totalCollected;
  if (updates.expiresOn !== undefined) row.expires_on = updates.expiresOn;
  if (Object.keys(row).length === 0) return;

  const { error } = await db().from("coupon_batches").update(row).eq("id", id);
  if (error) throw error;
  // Round 35: the coupons themselves carry the value their balance is
  // worked out from, so a corrected value has to reach them too.
  if (updates.couponValue !== undefined) {
    const { error: cErr } = await db().from("coupons").update({ value: updates.couponValue }).eq("batch_id", id);
    if (cErr) throw cErr;
  }
}

export async function getCouponBatches(): Promise<CouponBatch[]> {
  const [{ data: batches, error: batchErr }, { data: stats, error: statsErr }] = await Promise.all([
    db()
      .from("coupon_batches")
      .select("id, buyer_name, coupon_value, quantity, total_collected, sold_at, paid, collected, expires_on")
      .order("sold_at", { ascending: false }),
    db().rpc("coupon_batch_stats"),
  ]);
  if (batchErr) throw batchErr;
  if (statsErr) throw statsErr;

  const statsByBatch = new Map(
    ((stats ?? []) as { batch_id: string; used_up: number; partly_used: number; value_left: number }[]).map((r) => [r.batch_id, r])
  );

  return (batches ?? []).map((b) => ({
    id: b.id,
    buyerName: b.buyer_name,
    couponValue: Number(b.coupon_value),
    quantity: b.quantity,
    totalCollected: Number(b.total_collected),
    soldAt: b.sold_at,
    redeemedCount: statsByBatch.get(b.id)?.used_up ?? 0,
    partlyUsedCount: statsByBatch.get(b.id)?.partly_used ?? 0,
    valueLeft: Number(statsByBatch.get(b.id)?.value_left ?? 0),
    expiresOn: b.expires_on ?? null,
    paid: b.paid,
    collected: b.collected,
  }));
}

// ---------------------------------------------------------------------------
// Inventory admin
// ---------------------------------------------------------------------------

export async function getIngredients(): Promise<Ingredient[]> {
  const { data, error } = await db()
    .from("ingredients")
    .select("id, name, brand, unit, current_stock, low_stock_threshold, kind, previous_brand, brand_changed_on")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    brand: i.brand ?? null,
    unit: i.unit,
    currentStock: Number(i.current_stock),
    lowStockThreshold: Number(i.low_stock_threshold),
    kind: (i.kind ?? "raw") as Ingredient["kind"],
    previousBrand: i.previous_brand ?? null,
    brandChangedOn: i.brand_changed_on ?? null,
  }));
}

// Returns the new row's id -- Round 23's "link this to a menu item at
// creation time" form on /admin/inventory needs it immediately after
// creating, to make one follow-up setMenuItemIngredient() call.
export async function createIngredient(
  name: string,
  unit: string,
  currentStock: number,
  lowStockThreshold: number,
  brand?: string | null,
  kind?: Ingredient["kind"],
): Promise<{ id: string }> {
  const { data, error } = await db()
    .from("ingredients")
    .insert({
      name,
      brand: brand ?? null,
      unit,
      current_stock: currentStock,
      low_stock_threshold: lowStockThreshold,
      kind: kind ?? "raw",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

// Which menu items each ingredient is used in, with the qty/unit-label detail
// on each link -- powers both the small "Used in: ..." note under the
// ingredient name (Round 18) and the Round 22 ingredient-side "used in"
// editor (add/remove/edit a recipe link right from /admin/inventory, not
// just from the menu item's own edit panel). Two plain queries + an
// in-memory join, same pattern getMenuItemsAdmin already uses, rather than a
// nested-select join (keeps the FK relationship explicit and avoids any
// ambiguity if a second FK to menu_items is ever added).
export async function getIngredientRecipeLinks(): Promise<
  Record<string, { menuItemCode: string; menuItemName: string; qtyPerOrder: number; unitLabel: string | null }[]>
> {
  const [{ data: links, error: linkErr }, { data: items, error: itemErr }] = await Promise.all([
    db().from("menu_item_ingredients").select("ingredient_id, menu_item_code, qty_per_order, unit_label"),
    db().from("menu_items").select("code, name"),
  ]);
  if (linkErr) throw linkErr;
  if (itemErr) throw itemErr;

  const nameByCode = new Map((items ?? []).map((m) => [m.code, m.name]));
  const result: Record<string, { menuItemCode: string; menuItemName: string; qtyPerOrder: number; unitLabel: string | null }[]> = {};
  for (const link of links ?? []) {
    const name = nameByCode.get(link.menu_item_code);
    if (!name) continue;
    (result[link.ingredient_id] ??= []).push({
      menuItemCode: link.menu_item_code,
      menuItemName: name,
      qtyPerOrder: Number(link.qty_per_order),
      unitLabel: link.unit_label ?? null,
    });
  }
  for (const list of Object.values(result)) list.sort((a, b) => a.menuItemName.localeCompare(b.menuItemName));
  return result;
}

// Round 27: the "buy soon" / "can wait" call shown next to a low/out-of-stock
// ingredient on the low-stock alert -- see restockVerdict() in stock.ts for
// the rule. Computed from real sales over the trailing 30 days (today back
// 29 more, Asia/Bangkok calendar date, same convention getSalesAnalytics'
// callers use), live orders only -- the imported historical_sales log
// predates launch and won't fall in a trailing-30-day window anyway, so
// there's nothing to gain from querying it here. Keyed by ingredient id;
// only ingredients with at least one recipe link get an entry (nothing to
// judge a pace for otherwise) -- callers filter to the ones actually
// low/out.
export async function getRestockSignals(): Promise<Record<string, RestockSignal>> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const from = addDays(today, -29);

  const [ingredients, recipeLinks, { data: orders, error: ordersErr }] = await Promise.all([
    getIngredients(),
    getIngredientRecipeLinks(),
    db()
      .from("orders")
      .select("order_date, order_items(menu_item_code, qty)")
      .in("status", ["placed", "served", "paid"])
      .eq("is_trial", false)
      .gte("order_date", from)
      .lte("order_date", today),
  ]);
  if (ordersErr) throw ordersErr;

  type RawOrder = { order_date: string | null; order_items: { menu_item_code: string; qty: number }[] | null };
  const qtySoldByCode = new Map<string, number>();
  for (const order of (orders ?? []) as unknown as RawOrder[]) {
    for (const it of order.order_items ?? []) {
      qtySoldByCode.set(it.menu_item_code, (qtySoldByCode.get(it.menu_item_code) ?? 0) + it.qty);
    }
  }

  const result: Record<string, RestockSignal> = {};
  for (const ing of ingredients) {
    const links = recipeLinks[ing.id];
    if (!links || links.length === 0) continue;

    let totalUsed = 0;
    const usedIn: string[] = [];
    for (const link of links) {
      const qtySold = qtySoldByCode.get(link.menuItemCode) ?? 0;
      if (qtySold > 0) {
        totalUsed += qtySold * link.qtyPerOrder;
        usedIn.push(link.menuItemName);
      }
    }
    const avgDailyUsage = totalUsed / 30;
    const { verdict, daysOfStockLeft } = restockVerdict(ing.currentStock, avgDailyUsage);
    result[ing.id] = { verdict, avgDailyUsage, daysOfStockLeft, usedIn };
  }
  return result;
}

// Round 23: which raw ingredients each batch-prep primary is itself made
// from (the nested bill-of-materials) -- e.g. Chocolate Syrup <- Base Milk +
// Cocoa Powder + Sugar. Keyed by primary_id, mirrors getIngredientRecipeLinks
// above (plain query + in-memory join against ingredients for names/units,
// same reasoning: keeps the FK relationship explicit). Powers both the
// "what does a batch of this use?" preview and the /admin/inventory
// "Prep a batch" control. A primary with no rows here (e.g. Caramelised
// Onions, which has no documented SOP recipe) simply has an empty list --
// prep_batch() still works for it, crediting only its own stock.
export async function getPrimaryRecipeLinks(): Promise<Record<string, PrimaryRecipeLink[]>> {
  const [{ data: links, error: linkErr }, { data: ingredients, error: ingErr }] = await Promise.all([
    db().from("primary_ingredients").select("primary_id, raw_ingredient_id, qty_per_unit"),
    db().from("ingredients").select("id, name, unit"),
  ]);
  if (linkErr) throw linkErr;
  if (ingErr) throw ingErr;

  const byId = new Map((ingredients ?? []).map((i) => [i.id, i]));
  const result: Record<string, PrimaryRecipeLink[]> = {};
  for (const link of links ?? []) {
    const raw = byId.get(link.raw_ingredient_id);
    if (!raw) continue;
    (result[link.primary_id] ??= []).push({
      primaryId: link.primary_id,
      rawIngredientId: link.raw_ingredient_id,
      rawIngredientName: raw.name,
      rawIngredientUnit: raw.unit,
      qtyPerUnit: Number(link.qty_per_unit),
    });
  }
  for (const list of Object.values(result)) list.sort((a, b) => a.rawIngredientName.localeCompare(b.rawIngredientName));
  return result;
}

// Round 23: record a batch prep of a primary -- calls prep_batch(), which
// atomically deducts this primary's own raw ingredients (scaled to
// batchQty) and credits batchQty onto the primary's own stock. Throws
// PrepBatchError on any failure (invalid qty, unknown primary, or one or
// more raw ingredients too short -- the whole batch is blocked, same
// all-or-nothing semantics as place_order()/fulfill_pre_order()).
export async function prepBatch(primaryId: string, batchQty: number): Promise<{ newStock: number }> {
  const { data, error } = await db().rpc("prep_batch", {
    p_primary_id: primaryId,
    p_batch_qty: batchQty,
  });
  if (error) throw new PrepBatchError(error.message);
  return { newStock: Number(data.new_stock) };
}

// Edits an ingredient's metadata (name/brand/unit) and, optionally, sets its
// current stock directly to an absolute number (Round 18's "Edit" option on
// /admin/inventory) -- per the owner's explicit choice, this bypasses the
// +Restock/-Use amount entry, but a direct stock edit is still routed
// through adjustIngredientStock() below as a computed delta, so it still
// shows up in the stock-history log like every other stock change (just
// with no price, since it's a correction rather than a purchase).
export async function updateIngredient(
  id: string,
  updates: { name?: string; unit?: string; brand?: string | null; currentStock?: number; kind?: Ingredient["kind"] },
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (updates.name !== undefined) fields.name = updates.name;
  if (updates.unit !== undefined) fields.unit = updates.unit;
  if (updates.brand !== undefined) fields.brand = updates.brand;
  if (updates.kind !== undefined) fields.kind = updates.kind;
  if (Object.keys(fields).length > 0) {
    const { error } = await db().from("ingredients").update(fields).eq("id", id);
    if (error) throw error;
  }
  if (updates.currentStock !== undefined) {
    const { data, error: readErr } = await db().from("ingredients").select("current_stock").eq("id", id).single();
    if (readErr) throw readErr;
    const delta = updates.currentStock - Number(data.current_stock);
    if (delta !== 0) await adjustIngredientStock(id, delta, null);
  }
}

// Round 18's "Delete" option on /admin/inventory. Both menu_item_ingredients
// and stock_adjustments already have `ingredient_id ... on delete cascade`
// in schema.sql, so a plain delete here also removes every recipe link that
// used this ingredient and its entire restock/use history log -- the UI is
// responsible for warning about that (how many recipes, that history is
// lost) before calling this, since neither is recoverable afterward.
export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await db().from("ingredients").delete().eq("id", id);
  if (error) throw error;
}

// pricePaid: total THB paid for this restock (not a per-unit rate), owner's
// Round 13 request so the next restock can show "last time this cost ฿X."
// Optional — pass null/undefined for a plain restock or any "-Use" entry;
// only meaningful when delta > 0, so the caller shouldn't send it otherwise.
export async function adjustIngredientStock(id: string, delta: number, pricePaid?: number | null): Promise<void> {
  const { data, error: readErr } = await db().from("ingredients").select("current_stock").eq("id", id).single();
  if (readErr) throw readErr;
  const next = Math.max(0, Number(data.current_stock) + delta);
  const { error } = await db().from("ingredients").update({ current_stock: next }).eq("id", id);
  if (error) throw error;

  // Log the adjustment for the restock history view. Best-effort: if this
  // insert fails for some reason, the stock update above has already
  // succeeded, so we don't want to throw and make the caller think the
  // restock itself failed — just note it server-side.
  const { error: logErr } = await db()
    .from("stock_adjustments")
    .insert({ ingredient_id: id, delta, resulting_stock: next, price_paid: delta > 0 ? (pricePaid ?? null) : null });
  if (logErr) console.error("stock_adjustments insert failed", logErr);
}

type RawAdjustment = {
  id: number;
  ingredient_id: string;
  delta: number;
  resulting_stock: number;
  price_paid: number | string | null;
  created_at: string;
  ingredients: { name: string } | { name: string }[] | null;
};

function mapAdjustmentRow(raw: RawAdjustment): StockAdjustmentRow {
  const ingredient = Array.isArray(raw.ingredients) ? raw.ingredients[0] : raw.ingredients;
  return {
    id: raw.id,
    ingredientId: raw.ingredient_id,
    ingredientName: ingredient?.name ?? "(deleted ingredient)",
    delta: Number(raw.delta),
    resultingStock: Number(raw.resulting_stock),
    pricePaid: raw.price_paid === null || raw.price_paid === undefined ? null : Number(raw.price_paid),
    createdAt: raw.created_at,
  };
}

// Most recent priced restock per ingredient — powers the "last time we
// bought this" note next to the restock control. `distinct on` picks the
// single latest (delta > 0, price_paid recorded) row per ingredient in one
// query rather than N per-ingredient round trips.
export async function getLastRestockPrices(): Promise<Record<string, LastRestockPrice>> {
  const { data, error } = await db()
    .from("stock_adjustments")
    .select("ingredient_id, delta, price_paid, created_at")
    .not("price_paid", "is", null)
    .gt("delta", 0)
    .order("ingredient_id", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const result: Record<string, LastRestockPrice> = {};
  for (const row of data ?? []) {
    // Rows arrive latest-first within each ingredient_id group (secondary
    // sort above) — keep only the first one seen per ingredient.
    if (result[row.ingredient_id]) continue;
    result[row.ingredient_id] = {
      ingredientId: row.ingredient_id,
      delta: Number(row.delta),
      pricePaid: Number(row.price_paid),
      createdAt: row.created_at,
    };
  }
  return result;
}

export async function getRecentStockAdjustments(limit = 30): Promise<StockAdjustmentRow[]> {
  const { data, error } = await db()
    .from("stock_adjustments")
    .select("id, ingredient_id, delta, resulting_stock, created_at, ingredients(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((raw) => mapAdjustmentRow(raw as unknown as RawAdjustment));
}

// fromIso/toIso are plain "YYYY-MM-DD" dates (inclusive on both ends) — used
// by the full history page and its CSV export, both of which let staff pick
// any past range, including previous months, not just the most recent 30
// entries the Inventory page's quick view shows.
export async function getStockAdjustmentsInRange(fromIso: string, toIso: string): Promise<StockAdjustmentRow[]> {
  const { data, error } = await db()
    .from("stock_adjustments")
    .select("id, ingredient_id, delta, resulting_stock, created_at, ingredients(name)")
    .gte("created_at", `${fromIso}T00:00:00`)
    .lte("created_at", `${toIso}T23:59:59.999`)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((raw) => mapAdjustmentRow(raw as unknown as RawAdjustment));
}

// Testing/setup utilities — see the matching Postgres functions in
// schema.sql for exactly what each one does and why they're kept separate.
export async function resetAllOrders(): Promise<void> {
  const { error } = await db().rpc("reset_all_orders");
  if (error) throw error;
}

export async function resetAllStock(): Promise<void> {
  const { error } = await db().rpc("reset_all_stock");
  if (error) throw error;
}

export async function clearStockHistory(): Promise<void> {
  const { error } = await db().rpc("clear_stock_history");
  if (error) throw error;
}

// fromIso/toIso are plain "YYYY-MM-DD" dates (inclusive on both ends),
// matching the range pickers on getSalesAnalytics/getOrdersForExport above —
// filtered by order_date (the Bangkok-local day a walk-in order was placed,
// or a pre-order was fulfilled), same column those two read, so "clear this
// range" always matches what the analytics dashboard is showing for it.
// A still-pending pre-order has no order_date yet and is never touched by
// this, same as it's excluded from analytics until fulfilled.
export async function resetOrdersInRange(fromIso: string, toIso: string): Promise<void> {
  const { error } = await db().rpc("reset_orders_in_range", { p_from: fromIso, p_to: toIso });
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
    db()
      .from("menu_items")
      .select("code, name, category, price, active, yield_servings, yield_note, description, image_url, packaging_type")
      .order("sort_order"),
    db().from("menu_item_ingredients").select("menu_item_code, ingredient_id, qty_per_order, unit_label"),
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
    description: item.description ?? null,
    imageUrl: item.image_url ?? null,
    packagingType: item.packaging_type as MenuItem["packagingType"],
    yieldServings: Number(item.yield_servings ?? 1),
    yieldNote: item.yield_note ?? null,
    ingredients: (links ?? [])
      .filter((l) => l.menu_item_code === item.code)
      .map((l) => {
        const ing = ingredientsById.get(l.ingredient_id);
        return {
          ingredientId: l.ingredient_id,
          ingredientName: ing?.name ?? "(unknown)",
          unit: ing?.unit ?? "",
          qtyPerOrder: Number(l.qty_per_order),
          unitLabel: l.unit_label ?? null,
        };
      }),
  }));
}

// Round 18's "Delete" option on /admin/menu. menu_item_ingredients already
// cascades on delete (its recipe links go with it) and historical_sales
// already sets menu_item_code to null on delete (old sales stay, just
// unmatched, same as any other off-menu historical row). order_items has no
// FK to menu_items at all -- past orders keep their own frozen item_name/
// price_at_order snapshot regardless, so deleting the menu item never
// touches what a past receipt shows.
export async function deleteMenuItem(code: string): Promise<void> {
  const { error } = await db().from("menu_items").delete().eq("code", code);
  if (error) throw error;
}

// Round 18's "edit the code" option. code is menu_items' primary key, so
// this goes through the rename_menu_item_code() Postgres function rather
// than a plain update -- see schema.sql for why (it also has to touch
// order_items, which has no FK to cascade automatically).
export async function renameMenuItemCode(oldCode: string, newCode: string): Promise<void> {
  const { error } = await db().rpc("rename_menu_item_code", { p_old_code: oldCode, p_new_code: newCode });
  if (error) throw error;
}

export async function upsertMenuItem(item: {
  code: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  // Round 22: required (menu_items.packaging_type is NOT NULL) -- always
  // resent on every save, same as category/price, so /admin/menu's edit and
  // add-item forms both must carry a current value at all times.
  packagingType: MenuItem["packagingType"];
  yieldServings?: number;
  // Round 25: free-text companion to yieldServings -- see the MenuItemAdminView
  // comment. undefined = leave whatever's already stored alone (matches every
  // other optional field on this payload); null = explicitly clear it.
  yieldNote?: string | null;
  description?: string | null;
}): Promise<void> {
  const { data: existing } = await db().from("menu_items").select("code").eq("code", item.code).maybeSingle();

  // Only a genuinely new item needs a sort_order assigned — editing an
  // existing item's details (via this same endpoint) must never disturb its
  // place in the drag-ordered list, so sort_order is simply omitted then.
  let sortOrder: number | undefined;
  if (!existing) {
    const [{ data: sameCategoryMax }, { data: overallMax }] = await Promise.all([
      db().from("menu_items").select("sort_order").eq("category", item.category).order("sort_order", { ascending: false }).limit(1).maybeSingle(),
      db().from("menu_items").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle(),
    ]);
    // Append within the category if it already has items (keeps it grouped
    // with its siblings); otherwise append after the whole menu (a brand
    // new category not in the Menu PRD's fixed order lands at the end
    // rather than colliding with an existing category's sort_order range).
    sortOrder = sameCategoryMax ? sameCategoryMax.sort_order + 10 : (overallMax?.sort_order ?? 0) + 1000;
  }

  const payload: {
    code: string;
    name: string;
    category: string;
    price: number;
    active: boolean;
    packaging_type: MenuItem["packagingType"];
    sort_order?: number;
    yield_servings?: number;
    yield_note?: string | null;
    description?: string | null;
  } = {
    code: item.code,
    name: item.name,
    category: item.category,
    price: item.price,
    active: item.active,
    packaging_type: item.packagingType,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
    ...(item.yieldServings !== undefined ? { yield_servings: item.yieldServings } : {}),
    ...(item.yieldNote !== undefined ? { yield_note: item.yieldNote } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
  };
  const { error } = await db().from("menu_items").upsert(payload);
  if (error) throw error;
}

// Round 21: sets/replaces a menu item's photo URL after a successful upload
// to the 'menu-images' Storage bucket (see /api/menu/[code]/image). A
// separate function from upsertMenuItem so the image-upload route doesn't
// need to resend the item's other fields just to change one column.
export async function updateMenuItemImage(code: string, imageUrl: string | null): Promise<void> {
  const { error } = await db().from("menu_items").update({ image_url: imageUrl }).eq("code", code);
  if (error) throw error;
}

// Persists a new within-category display order after a drag-and-drop reorder
// in the admin Menu page. `orderedCodes` must all belong to the same
// category (the client only ever drags within one category's section).
// Renumbered relative to the lowest sort_order already among them, so the
// category's block stays put relative to every other category.
export async function reorderMenuItems(orderedCodes: string[]): Promise<void> {
  if (orderedCodes.length === 0) return;
  const { data: rows, error: readErr } = await db().from("menu_items").select("code, sort_order").in("code", orderedCodes);
  if (readErr) throw readErr;
  if (!rows || rows.length === 0) return;

  const base = Math.min(...rows.map((r) => r.sort_order));
  const updates = orderedCodes.map((code, i) =>
    db().from("menu_items").update({ sort_order: base + i * 10 }).eq("code", code)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function setMenuItemActive(code: string, active: boolean): Promise<void> {
  const { error } = await db().from("menu_items").update({ active }).eq("code", code);
  if (error) throw error;
}

// unitLabel is the Round 22 typable display override -- omit the argument
// entirely (leave it undefined) to leave an existing label untouched on an
// update; pass null explicitly to clear it. Reused as-is by the reverse
// ingredient-side "used in" editor (see /admin/inventory) -- this function
// doesn't care which screen initiated the link.
export async function setMenuItemIngredient(
  menuItemCode: string,
  ingredientId: string,
  qtyPerOrder: number,
  unitLabel?: string | null,
): Promise<void> {
  const { error } = await db()
    .from("menu_item_ingredients")
    .upsert({
      menu_item_code: menuItemCode,
      ingredient_id: ingredientId,
      qty_per_order: qtyPerOrder,
      ...(unitLabel !== undefined ? { unit_label: unitLabel } : {}),
    });
  if (error) throw error;
}

export async function removeMenuItemIngredient(menuItemCode: string, ingredientId: string): Promise<void> {
  const { error } = await db().from("menu_item_ingredients").delete().eq("menu_item_code", menuItemCode).eq("ingredient_id", ingredientId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Sales & analytics
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Best-effort category guess for historical items that never matched a
// current menu item, so "Sales by category" doesn't dump every off-menu
// item into one generic wedge and lose what kind of thing they actually
// were. Keyed by the exact historical item name (see MAPPING in
// scripts/historical/build_import.py, which reviewed each of these
// individually) — anything not listed here (there shouldn't be any, but a
// future off-menu row could show up if the import script's mapping ever
// changes) falls back to a generic "no longer on menu" bucket rather than
// guessing blind.
const HISTORICAL_CATEGORY_HINTS: Record<string, string> = {
  "Chicken Burger": "Burger",
  "Chicken Katti Roll": "Snacks",
  Fries: "Snacks",
  Doritos: "Snacks",
  "Pani Puri": "Snacks",
  Coke: "Soda",
  Lemonade: "Soda",
  "Alfredo Pasta": "Spaghetti",
  Pasta: "Spaghetti",
  "Pasta White saucs": "Spaghetti",
  "Milk Coffee": "Coffee",
  "Milk Coffee Iced": "Coffee",
  "Passion Lemon Iced tea": "Iced Tea",
  "Mango passion Iced tea": "Iced Tea",
  "Black Tea Lemon": "Tea",
  "Lemon Tea Hot": "Tea",
  "Green Tea Lemon": "Tea",
  "Tuna Sandwich": "Sandwich",
};

// Lean version of getSalesAnalytics used only for the "vs previous period"
// comparison — just the two totals, not the full item/category/hour
// breakdown, so the extra round trip stays cheap.
async function getPeriodTotals(from: string, to: string): Promise<PeriodTotals> {
  const [{ data: orders, error: ordersErr }, { data: historical, error: histErr }] = await Promise.all([
    db()
      .from("orders")
      .select("discount_amount, order_items(qty, price_at_order)")
      .in("status", ["placed", "served", "paid"])
      .eq("is_trial", false)
      .gte("order_date", from)
      .lte("order_date", to),
    db().from("historical_sales").select("total_revenue").gte("sale_date", from).lte("sale_date", to),
  ]);
  if (ordersErr) throw ordersErr;
  if (histErr) throw histErr;

  type RawItem = { qty: number; price_at_order: number };
  type RawOrder = { discount_amount: number; order_items: RawItem[] | null };

  let revenue = 0;
  let orderCount = 0;
  for (const order of (orders ?? []) as unknown as RawOrder[]) {
    const gross = (order.order_items ?? []).reduce((sum, it) => sum + it.qty * Number(it.price_at_order), 0);
    revenue += Math.max(0, gross - Number(order.discount_amount));
    orderCount += 1;
  }
  for (const h of (historical ?? []) as unknown as { total_revenue: number | null }[]) {
    revenue += Number(h.total_revenue ?? 0);
  }
  return { revenue, orders: orderCount };
}

// Orders count as "sales" once they're real (placed, served, or paid — every
// stage after checkout/fulfillment) — a pending pre-order hasn't happened yet
// (order_date is null until fulfillment, so it wouldn't match a date range
// anyway) and isn't counted. Including 'paid' matters here: without it, an
// order would silently drop out of every sales report the moment staff
// closed its bill on /billing, which would make daily totals shrink over
// the course of the day as tables paid up — exactly backwards.
export async function getSalesAnalytics(from: string, to: string): Promise<SalesAnalytics> {
  const periodLength = daysBetweenInclusive(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(Math.max(periodLength, 1) - 1));

  const [
    { data: orders, error: ordersErr },
    { data: menuItems, error: menuErr },
    { data: historical, error: histErr },
    previousPeriod,
  ] = await Promise.all([
    db()
      .from("orders")
      .select("id, order_date, discount_amount, payment_method, created_at, source, order_items(menu_item_code, item_name, qty, price_at_order), order_payments(method, amount), order_coupons(amount)")
      .in("status", ["placed", "served", "paid"])
      .eq("is_trial", false)
      .gte("order_date", from)
      .lte("order_date", to),
    // Round 24: category for the category-totals chart, cogs_thb for the
    // costing-table-based profit estimate below (see the ProfitEstimate type).
    db().from("menu_items").select("code, category, cogs_thb"),
    db()
      .from("historical_sales")
      .select("sale_date, item_name, menu_item_code, quantity, total_revenue, payment_note")
      .gte("sale_date", from)
      .lte("sale_date", to),
    getPeriodTotals(prevFrom, prevTo),
  ]);
  if (ordersErr) throw ordersErr;
  if (menuErr) throw menuErr;
  if (histErr) throw histErr;

  const categoryByCode = new Map((menuItems ?? []).map((m) => [m.code, m.category]));

  // Round 24: cost per unit sold, straight from the Tan90 Costing Table PDF
  // (menu_items.cogs_thb, seeded in schema.sql). No entry means the costing
  // table didn't cover that item -- the profit loop below excludes those
  // lines rather than guessing their cost as zero.
  const cogsByCode = new Map<string, number>();
  for (const m of (menuItems ?? []) as { code: string; cogs_thb: number | string | null }[]) {
    if (m.cogs_thb !== null && m.cogs_thb !== undefined) cogsByCode.set(m.code, Number(m.cogs_thb));
  }
  function estimateLineCost(code: string): number | null {
    return cogsByCode.get(code) ?? null;
  }
  let profitRevenueCounted = 0;
  let profitCostCounted = 0;
  let profitExcludedRevenue = 0;
  let profitExcludedLineItems = 0;

  const dailyMap = new Map<string, { orderCount: number; revenue: number }>();
  const itemMap = new Map<string, ItemRanking>();
  const categoryMap = new Map<string, number>();
  const pairCounts = new Map<string, ItemPair>();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orderCount: 0, revenue: 0 }));
  const weekdayRevenue = new Array(7).fill(0);
  let totalRevenue = 0;
  let totalDiscount = 0;
  // Round 17: cash vs online, for live orders only — the source data behind
  // paid orders is the only place this is actually recorded. "unknown"
  // covers both an order not yet marked paid and one paid before this
  // feature existed; either way there's no real payment method to report.
  const paymentSplit = { cash: 0, cashOrders: 0, online: 0, onlineOrders: 0, unknown: 0, unknownOrders: 0 };
  // Round 32: QR (customer scanned a code) vs counter (staff entered it).
  const sourceSplit = { qrRevenue: 0, qrOrders: 0, counterRevenue: 0, counterOrders: 0 };

  type RawItem = { menu_item_code: string; item_name: string; qty: number; price_at_order: number };
  type RawOrder = {
    id: string;
    order_date: string | null;
    discount_amount: number;
    payment_method: string | null;
    created_at: string;
    source: string | null;
    order_items: RawItem[] | null;
    order_payments: { method: string; amount: number }[] | null;
  };

  for (const order of (orders ?? []) as unknown as RawOrder[]) {
    if (!order.order_date) continue;
    const items = order.order_items ?? [];
    const orderGross = items.reduce((sum, it) => sum + it.qty * Number(it.price_at_order), 0);
    const discount = Number(order.discount_amount);
    const orderNet = Math.max(0, orderGross - discount);
    totalRevenue += orderNet;
    totalDiscount += discount;

    if (order.source === "counter") {
      sourceSplit.counterRevenue += orderNet;
      sourceSplit.counterOrders += 1;
    } else {
      sourceSplit.qrRevenue += orderNet;
      sourceSplit.qrOrders += 1;
    }

    // Round 32: orders with recorded payment rows (every counter order, and
    // every bill paid on /billing from now on) are split by what was actually
    // received -- a split bill counts toward both methods. Anything still
    // owed stays "unknown". Older orders fall back to payment_method.
    const payments = order.order_payments ?? [];
    if (payments.length > 0) {
      let cashPaid = 0;
      let onlinePaid = 0;
      for (const p of payments) {
        if (p.method === "cash") cashPaid += Number(p.amount);
        else if (p.method === "online") onlinePaid += Number(p.amount);
      }
      if (cashPaid !== 0) {
        paymentSplit.cash += cashPaid;
        paymentSplit.cashOrders += 1;
      }
      if (onlinePaid !== 0) {
        paymentSplit.online += onlinePaid;
        paymentSplit.onlineOrders += 1;
      }
      const owed = orderNet - cashPaid - onlinePaid;
      if (owed > 0.005) {
        paymentSplit.unknown += owed;
        paymentSplit.unknownOrders += 1;
      }
    } else if (order.payment_method === "cash") {
      paymentSplit.cash += orderNet;
      paymentSplit.cashOrders += 1;
    } else if (order.payment_method === "online") {
      paymentSplit.online += orderNet;
      paymentSplit.onlineOrders += 1;
    } else {
      paymentSplit.unknown += orderNet;
      paymentSplit.unknownOrders += 1;
    }

    const day = dailyMap.get(order.order_date) ?? { orderCount: 0, revenue: 0 };
    day.orderCount += 1;
    day.revenue += orderNet;
    dailyMap.set(order.order_date, day);

    weekdayRevenue[weekdayOf(order.order_date)] += orderNet;

    const bangkokHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false }).format(new Date(order.created_at))
    ) % 24;
    hourly[bangkokHour].orderCount += 1;
    hourly[bangkokHour].revenue += orderNet;

    for (const it of items) {
      const lineRevenue = it.qty * Number(it.price_at_order);
      const existing = itemMap.get(it.menu_item_code) ?? { code: it.menu_item_code, name: it.item_name, qty: 0, revenue: 0 };
      existing.qty += it.qty;
      existing.revenue += lineRevenue;
      itemMap.set(it.menu_item_code, existing);

      const category = categoryByCode.get(it.menu_item_code) ?? "Other";
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + lineRevenue);

      const unitCost = estimateLineCost(it.menu_item_code);
      if (unitCost === null) {
        profitExcludedRevenue += lineRevenue;
        profitExcludedLineItems += 1;
      } else {
        profitRevenueCounted += lineRevenue;
        profitCostCounted += unitCost * it.qty;
      }
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

  // Fold in the imported historical sales log (Round 14) — same
  // dailyTotals/bestsellers/categoryTotals/weekdayTotals buckets as live
  // orders, so a date range spanning both shows one combined picture.
  // Deliberately does NOT touch orderCount, topPairs, or hourlyTotals: the
  // source data has no order/seat/time-of-day info (see historical_sales in
  // schema.sql), only day-level item x quantity x price lines, so there's
  // nothing honest to count as an "order", a pairing, or a time of day.
  let historicalRevenue = 0;
  // Separate from paymentSplit above — the spreadsheet only ever wrote
  // "Cash" as a free-text note some of the time (see payment_note in
  // scripts/historical/build_import*.py), never "Online" (that concept
  // didn't exist pre-launch), so an absent note means unnoted, not online.
  // Just a count/total of what the sheet itself flagged as cash.
  let historicalCashCount = 0;
  let historicalCashRevenue = 0;
  type RawHistorical = {
    sale_date: string;
    item_name: string;
    menu_item_code: string | null;
    quantity: number;
    total_revenue: number | null;
    payment_note: string | null;
  };
  for (const h of (historical ?? []) as unknown as RawHistorical[]) {
    const revenue = Number(h.total_revenue ?? 0);
    historicalRevenue += revenue;
    totalRevenue += revenue;
    if (h.payment_note && h.payment_note.toLowerCase().includes("cash")) {
      historicalCashCount += 1;
      historicalCashRevenue += revenue;
    }

    const day = dailyMap.get(h.sale_date) ?? { orderCount: 0, revenue: 0 };
    day.revenue += revenue;
    dailyMap.set(h.sale_date, day);

    weekdayRevenue[weekdayOf(h.sale_date)] += revenue;

    // Matched items merge into the same bucket a live order for that code
    // would use, so a bestseller's total reflects both eras. Unmatched
    // items get their own synthetic key (never collides with a real
    // menu_items.code) and are flagged offMenu for the UI to highlight.
    const key = h.menu_item_code ?? `hist:${h.item_name}`;
    const existing = itemMap.get(key) ?? { code: key, name: h.item_name, qty: 0, revenue: 0, offMenu: !h.menu_item_code };
    existing.qty += h.quantity;
    existing.revenue += revenue;
    itemMap.set(key, existing);

    // Off-menu items still count toward their real category where we can
    // tell what kind of item they were, so a discontinued burger still
    // shows up under "Burger" rather than a catch-all "historical" bucket
    // that erases what it actually was.
    const category = h.menu_item_code
      ? categoryByCode.get(h.menu_item_code) ?? "Other"
      : HISTORICAL_CATEGORY_HINTS[h.item_name] ?? "Other (no longer on menu)";
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + revenue);

    // Round 24: historical rows now feed the profit estimate too -- a PDF
    // costing-table price has no restock-history dependency the way the old
    // restock-price average did, so there's no reason to keep excluding the
    // pre-launch era wholesale. Still excluded per-line when there's no
    // matched menu_item_code (nothing to look a cost up by) or no cogs_thb
    // on file for that item, same as a live order line.
    const histCost = h.menu_item_code ? estimateLineCost(h.menu_item_code) : null;
    if (histCost === null) {
      profitExcludedRevenue += revenue;
      profitExcludedLineItems += 1;
    } else {
      profitRevenueCounted += revenue;
      profitCostCounted += histCost * h.quantity;
    }
  }

  const rankedItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);

  // Zero-fill every date in range so a sparsely-populated month (or one
  // with no live orders yet) still renders as a full month instead of
  // silently skipping straight from, say, Jul 7 to nothing — see the
  // 366-day cap note on enumerateDates above.
  const allDates = enumerateDates(from, to);
  const dailyTotals =
    allDates.length > 0
      ? allDates.map((date) => {
          const v = dailyMap.get(date);
          return { date, orderCount: v?.orderCount ?? 0, revenue: v?.revenue ?? 0 };
        })
      : Array.from(dailyMap.entries())
          .map(([date, v]) => ({ date, orderCount: v.orderCount, revenue: v.revenue }))
          .sort((a, b) => a.date.localeCompare(b.date));

  const weekdayOccurrences = new Array(7).fill(0);
  for (const date of allDates.length > 0 ? allDates : []) {
    weekdayOccurrences[weekdayOf(date)] += 1;
  }
  // If the range exceeded the enumeration cap, fall back to counting
  // occurrences the direct way so weekdayTotals still has correct divisors.
  if (allDates.length === 0) {
    for (let i = 0; i < periodLength; i++) {
      weekdayOccurrences[weekdayOf(addDays(from, i))] += 1;
    }
  }

  return {
    from,
    to,
    totalRevenue,
    totalOrders: Array.from(dailyMap.values()).reduce((sum, d) => sum + d.orderCount, 0),
    dailyTotals,
    bestsellers: rankedItems.slice(0, 10),
    leastSellers: [...rankedItems].reverse().slice(0, 10),
    categoryTotals: Array.from(categoryMap.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    topPairs: Array.from(pairCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    historicalRevenue,
    previousPeriod,
    hourlyTotals: hourly,
    weekdayTotals: WEEKDAY_LABELS.map((label, weekday) => ({
      weekday,
      label,
      revenue: weekdayRevenue[weekday],
      occurrences: weekdayOccurrences[weekday],
    })),
    couponSummary: {
      discountGiven: totalDiscount,
      // Round 35: coupons can be partly used, so this counts each coupon
      // use on a bill in the range (and the money it took off).
      redeemedCount: (orders ?? []).reduce((n, o) => n + ((o as { order_coupons?: unknown[] }).order_coupons ?? []).length, 0),
      redeemedValue: (orders ?? []).reduce(
        (sum, o) => sum + ((o as { order_coupons?: { amount: number }[] }).order_coupons ?? []).reduce((s2, c) => s2 + Number(c.amount), 0),
        0
      ),
    },
    paymentSplit,
    sourceSplit,
    historicalCashNote: { count: historicalCashCount, revenue: historicalCashRevenue },
    profit: {
      estimated: profitRevenueCounted - profitCostCounted,
      revenueCounted: profitRevenueCounted,
      costCounted: profitCostCounted,
      excludedRevenue: profitExcludedRevenue,
      excludedLineItems: profitExcludedLineItems,
    },
  };
}

// One row per real order (placed/served/paid) in [from, to], for the
// Analytics page's CSV export — same date range the on-screen numbers use,
// so exporting a previous month is just picking that range before clicking
// export. A pre-order still sitting in pending_pickup has no order_date yet
// and won't match a date filter either way, same as getSalesAnalytics.
export async function getOrdersForExport(from: string, to: string): Promise<OrderRow[]> {
  const { data, error } = await db()
    .from("orders")
    .select(ORDER_ROW_SELECT)
    .in("status", ["placed", "served", "paid"])
    .eq("is_trial", false)
    .gte("order_date", from)
    .lte("order_date", to)
    .order("order_date")
    .order("daily_order_number");

  if (error) throw error;
  return (data ?? []).map((o) => mapOrderRow(o as unknown as RawOrderRow));
}
