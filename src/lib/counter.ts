// Round 32: data access for the staff counter (/counter) and the cash
// balance page (/cash). All writes go through Postgres functions in
// schema.sql (place_counter_order, update_counter_order, void_order,
// add_order_payment, ...) so day-locks, coupon validation and the audit log
// are enforced in one place, whatever screen calls them.
import { db } from "./supabase";
import type {
  CashDay,
  CounterDay,
  CounterOrder,
  FulfillmentType,
  OrderCouponRow,
  OrderPaymentRow,
  PaymentMethod,
  StaffMember,
} from "./types";

export class CounterError extends Error {
  code: string;
  detail?: string;

  constructor(rawMessage: string) {
    super(rawMessage);
    const idx = rawMessage.indexOf(":");
    this.code = (idx === -1 ? rawMessage : rawMessage.slice(0, idx)).trim();
    this.detail = idx === -1 ? undefined : rawMessage.slice(idx + 1).trim();
  }

  // Errors that will fail the same way on every retry -- an offline order
  // that hits one of these needs a person to look at it, not another sync.
  get permanent(): boolean {
    return [
      "empty_order",
      "invalid_kind",
      "missing_requested_date",
      "day_locked",
      "invalid_item",
      "unknown_item",
      "invalid_fulfillment_type",
      "unknown_coupon",
      "coupon_already_redeemed",
      "invalid_payment_method",
      "missing_client_key",
      "unknown_order",
      "order_voided",
      "already_resolved",
      "invalid_amount",
      "invalid_coupon_input",
      "unknown_order_coupon",
    ].includes(this.code);
  }

  get friendlyMessage(): string {
    switch (this.code) {
      case "empty_order":
        return "The order has no items.";
      case "missing_requested_date":
        return "Pick a pickup date for the pre-order.";
      case "day_locked":
        return `That day (${this.detail ?? ""}) is locked. Unlock it on the daily summary first.`;
      case "unknown_item":
        return `An item on this order isn't on the menu any more (${this.detail ?? ""}).`;
      case "invalid_item":
        return "One of the items has an invalid quantity.";
      case "unknown_coupon":
        return `Coupon ${this.detail ?? ""} isn't in the system.`;
      case "coupon_already_redeemed":
        return `Coupon ${this.detail ?? ""} has already been used.`;
      case "order_voided":
        return "This order was voided.";
      case "already_resolved":
        return "That coupon already has its code.";
      case "invalid_amount":
        return "Enter an amount.";
      case "invalid_payment_method":
        return "Pick Cash or Online.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
}

function rpcError(err: { message: string }): CounterError {
  return new CounterError(err.message);
}

export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function getStaff(includeInactive = false): Promise<StaffMember[]> {
  let q = db().from("staff").select("id, name, active, sort_order").order("sort_order").order("name");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, active: r.active, sortOrder: r.sort_order }));
}

export async function addStaff(name: string): Promise<void> {
  const { data: last } = await db().from("staff").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const next = ((last ?? [])[0]?.sort_order ?? 0) + 10;
  const { error } = await db().from("staff").insert({ name: name.trim(), sort_order: next });
  if (error) {
    if (error.code === "23505") throw new Error("Someone with that name is already on the list.");
    throw error;
  }
}

export async function updateStaff(id: string, updates: { name?: string; active?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name.trim();
  if (updates.active !== undefined) row.active = updates.active;
  const { error } = await db().from("staff").update(row).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Someone with that name is already on the list.");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Placing / syncing counter orders
// ---------------------------------------------------------------------------

export interface CounterOrderInput {
  clientKey: string;
  clientCreatedAt: string;
  staffId: string | null;
  kind: "walk_in" | "pre_order";
  customerLabel?: string;
  requestedDate?: string;
  requestedTime?: string;
  items: { code: string; qty: number; fulfillmentType: FulfillmentType; note?: string }[];
  discountPct?: number | null;
  discountAmount?: number | null;
  discountNote?: string;
  coupons?: ({ code: string } | { pendingAmount: number })[];
  payments?: { method: PaymentMethod; amount: number }[];
}

export type CounterSyncResult =
  | { clientKey: string; ok: true; orderId: string; dailyOrderNumber: number | null; alreadyExisted: boolean; warnings: string[] }
  | { clientKey: string; ok: false; permanent: boolean; error: string };

export async function placeCounterOrder(input: CounterOrderInput, softCoupons: boolean): Promise<CounterSyncResult> {
  const { data, error } = await db().rpc("place_counter_order", { p: { ...input, softCoupons } });
  if (error) {
    const e = rpcError(error);
    return { clientKey: input.clientKey, ok: false, permanent: e.permanent, error: e.friendlyMessage };
  }
  return {
    clientKey: input.clientKey,
    ok: true,
    orderId: data.order_id,
    dailyOrderNumber: data.daily_order_number ?? null,
    alreadyExisted: !!data.already_existed,
    warnings: (data.warnings ?? []) as string[],
  };
}

export async function updateCounterOrder(
  orderId: string,
  input: Omit<CounterOrderInput, "clientKey" | "clientCreatedAt" | "kind" | "coupons" | "payments" | "items"> & {
    items: { code: string; qty: number; fulfillmentType: FulfillmentType; note?: string; price?: number }[];
  }
): Promise<void> {
  const { error } = await db().rpc("update_counter_order", { p_order_id: orderId, p: input });
  if (error) throw rpcError(error);
}

export async function voidCounterOrder(orderId: string, reason: string, staffId: string | null): Promise<void> {
  const { error } = await db().rpc("void_order", { p_order_id: orderId, p_reason: reason, p_staff_id: staffId });
  if (error) throw rpcError(error);
}

export async function addOrderPayment(
  orderId: string,
  method: PaymentMethod,
  amount: number,
  receivedOn: string,
  staffId: string | null,
  note: string | null
): Promise<void> {
  const { error } = await db().rpc("add_order_payment", {
    p_order_id: orderId,
    p_method: method,
    p_amount: amount,
    p_received_on: receivedOn,
    p_staff_id: staffId,
    p_note: note,
  });
  if (error) throw rpcError(error);
}

export async function deleteOrderPayment(paymentId: number, staffId: string | null): Promise<void> {
  const { error } = await db().rpc("delete_order_payment", { p_payment_id: paymentId, p_staff_id: staffId });
  if (error) throw rpcError(error);
}

export async function addOrderCoupon(orderId: string, code: string | null, pendingAmount: number | null, staffId: string | null): Promise<void> {
  const { error } = await db().rpc("add_order_coupon", {
    p_order_id: orderId,
    p_code: code,
    p_pending_amount: pendingAmount,
    p_staff_id: staffId,
  });
  if (error) throw rpcError(error);
}

export async function resolvePendingCoupon(orderCouponId: number, code: string, staffId: string | null): Promise<void> {
  const { error } = await db().rpc("resolve_pending_coupon", {
    p_order_coupon_id: orderCouponId,
    p_code: code,
    p_staff_id: staffId,
  });
  if (error) throw rpcError(error);
}

export async function setDayLocked(day: string, locked: boolean, staffId: string | null): Promise<void> {
  if (locked) {
    const { error } = await db().from("day_locks").upsert({ day, staff_id: staffId, locked_at: new Date().toISOString() });
    if (error) throw error;
  } else {
    const { error } = await db().from("day_locks").delete().eq("day", day);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Reading: one day at the counter
// ---------------------------------------------------------------------------

const COUNTER_ORDER_SELECT =
  "id, daily_order_number, order_date, seat_id, status, order_type, requested_date, requested_time, coupon_code, discount_amount, payment_method, created_at, source, customer_label, manual_discount_pct, manual_discount_amount, discount_note, voided_at, void_reason, staff:staff_id(name), order_items(id, menu_item_code, item_name, qty, price_at_order, fulfillment_type, note), order_payments(id, method, amount, received_on, note, created_at, staff:staff_id(name)), order_coupons(id, coupon_code, amount, attempted_code)";

type RawCounterOrder = {
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
  source: string;
  customer_label: string | null;
  manual_discount_pct: number | null;
  manual_discount_amount: number;
  discount_note: string | null;
  voided_at: string | null;
  void_reason: string | null;
  staff: { name: string } | null;
  order_items: { id: number; menu_item_code: string; item_name: string; qty: number; price_at_order: number; fulfillment_type: string; note: string | null }[] | null;
  order_payments: { id: number; method: string; amount: number; received_on: string; note: string | null; created_at: string; staff: { name: string } | null }[] | null;
  order_coupons: { id: number; coupon_code: string | null; amount: number; attempted_code: string | null }[] | null;
};

function mapCounterOrder(o: RawCounterOrder): CounterOrder {
  const items = (o.order_items ?? [])
    .sort((a, b) => a.id - b.id)
    .map((it) => ({
      id: it.id,
      menuItemCode: it.menu_item_code,
      itemName: it.item_name,
      qty: it.qty,
      priceAtOrder: Number(it.price_at_order),
      fulfillmentType: it.fulfillment_type as FulfillmentType,
      note: it.note ?? null,
    }));
  const payments: OrderPaymentRow[] = (o.order_payments ?? [])
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      id: p.id,
      method: p.method as PaymentMethod,
      amount: Number(p.amount),
      receivedOn: p.received_on,
      staffName: p.staff?.name ?? null,
      note: p.note,
      createdAt: p.created_at,
    }));
  const coupons: OrderCouponRow[] = (o.order_coupons ?? [])
    .sort((a, b) => a.id - b.id)
    .map((c) => ({ id: c.id, code: c.coupon_code, amount: Number(c.amount), attemptedCode: c.attempted_code }));
  const gross = items.reduce((sum, it) => sum + it.qty * it.priceAtOrder, 0);
  const net = Math.max(0, gross - Number(o.discount_amount));
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    id: o.id,
    dailyOrderNumber: o.daily_order_number,
    orderDate: o.order_date,
    seatId: o.seat_id,
    status: o.status as CounterOrder["status"],
    orderType: o.order_type as CounterOrder["orderType"],
    requestedDate: o.requested_date,
    requestedTime: o.requested_time,
    couponCode: o.coupon_code,
    discountAmount: Number(o.discount_amount),
    paymentMethod: (o.payment_method as PaymentMethod | null) ?? null,
    createdAt: o.created_at,
    items,
    source: o.source === "counter" ? "counter" : "qr",
    customerLabel: o.customer_label,
    amountPaid,
    staffName: o.staff?.name ?? null,
    manualDiscountPct: o.manual_discount_pct === null ? null : Number(o.manual_discount_pct),
    manualDiscountAmount: Number(o.manual_discount_amount),
    discountNote: o.discount_note,
    voidedAt: o.voided_at,
    voidReason: o.void_reason,
    payments,
    coupons,
    gross,
    net,
    outstanding: o.status === "void" ? 0 : Math.round((net - amountPaid) * 100) / 100,
  };
}

export async function getCounterDay(date: string): Promise<CounterDay> {
  const [{ data: orders, error: ordersErr }, { data: received, error: recErr }, { data: lock, error: lockErr }] = await Promise.all([
    db().from("orders").select(COUNTER_ORDER_SELECT).eq("order_date", date).order("daily_order_number"),
    db().from("order_payments").select("method, amount, orders!inner(status)").eq("received_on", date).neq("orders.status", "void"),
    db().from("day_locks").select("day").eq("day", date).maybeSingle(),
  ]);
  if (ordersErr) throw ordersErr;
  if (recErr) throw recErr;
  if (lockErr) throw lockErr;

  const mapped = (orders ?? []).map((o) => mapCounterOrder(o as unknown as RawCounterOrder));
  const live = mapped.filter((o) => o.status !== "void");

  let cashReceived = 0;
  let onlineReceived = 0;
  for (const p of (received ?? []) as unknown as { method: string; amount: number }[]) {
    if (p.method === "cash") cashReceived += Number(p.amount);
    else onlineReceived += Number(p.amount);
  }

  return {
    summary: {
      date,
      locked: !!lock,
      orderCount: live.length,
      qrOrders: live.filter((o) => o.source === "qr").length,
      counterOrders: live.filter((o) => o.source === "counter").length,
      gross: live.reduce((s, o) => s + o.gross, 0),
      discount: live.reduce((s, o) => s + Math.min(o.discountAmount, o.gross), 0),
      net: live.reduce((s, o) => s + o.net, 0),
      cashReceived,
      onlineReceived,
      couponTotal: live.reduce((s, o) => s + o.coupons.reduce((cs, c) => cs + c.amount, 0), 0),
      pendingCoupons: live.reduce((s, o) => s + o.coupons.filter((c) => !c.code).length, 0),
      outstanding: live.reduce((s, o) => s + Math.max(0, o.outstanding), 0),
    },
    orders: mapped,
  };
}

// Counter pre-orders still waiting to be picked up (any booking day), and
// counter orders from recent days still owing money or a coupon code -- the
// "to-fix" list. QR orders still owing are handled on /billing as before.
export async function getCounterOpenItems(): Promise<{ pickups: CounterOrder[]; outstanding: CounterOrder[] }> {
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const [{ data: pickups, error: pickErr }, { data: recent, error: recentErr }] = await Promise.all([
    db().from("orders").select(COUNTER_ORDER_SELECT).eq("status", "pending_pickup").order("requested_date").order("requested_time"),
    db()
      .from("orders")
      .select(COUNTER_ORDER_SELECT)
      .eq("source", "counter")
      .neq("status", "void")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);
  if (pickErr) throw pickErr;
  if (recentErr) throw recentErr;
  const outstanding = (recent ?? [])
    .map((o) => mapCounterOrder(o as unknown as RawCounterOrder))
    .filter((o) => o.status !== "pending_pickup" && (o.outstanding > 0.005 || o.coupons.some((c) => !c.code)));
  return {
    pickups: (pickups ?? []).map((o) => mapCounterOrder(o as unknown as RawCounterOrder)),
    outstanding,
  };
}

export async function getOrderAudit(orderId: string): Promise<{ action: string; staffName: string | null; detail: unknown; createdAt: string }[]> {
  const { data, error } = await db()
    .from("order_audit_log")
    .select("action, detail, created_at, staff:staff_id(name)")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as { action: string; detail: unknown; created_at: string; staff: { name: string } | null }[]).map((r) => ({
    action: r.action,
    staffName: r.staff?.name ?? null,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Cash balance
// ---------------------------------------------------------------------------

export async function getCashDay(day: string): Promise<CashDay> {
  const [{ data: row, error: rowErr }, { data: prev, error: prevErr }, { data: pays, error: payErr }] = await Promise.all([
    db().from("cash_days").select("day, opening, closing_counted, note, updated_at").eq("day", day).maybeSingle(),
    db().from("cash_days").select("day, closing_counted").lt("day", day).not("closing_counted", "is", null).order("day", { ascending: false }).limit(1),
    db().from("order_payments").select("amount, orders!inner(status)").eq("received_on", day).eq("method", "cash").neq("orders.status", "void"),
  ]);
  if (rowErr) throw rowErr;
  if (prevErr) throw prevErr;
  if (payErr) throw payErr;

  let cashReceived = 0;
  let cashRefunded = 0;
  for (const p of (pays ?? []) as unknown as { amount: number }[]) {
    const a = Number(p.amount);
    if (a >= 0) cashReceived += a;
    else cashRefunded += -a;
  }
  // Purchases paid from the drawer arrive with the purchase tracker (next
  // round); until then this is always 0.
  const cashPurchases = 0;

  const opening = row?.opening === null || row?.opening === undefined ? null : Number(row.opening);
  const closingCounted = row?.closing_counted === null || row?.closing_counted === undefined ? null : Number(row.closing_counted);
  const suggestedOpening = (prev ?? [])[0]?.closing_counted === undefined ? null : Number((prev ?? [])[0].closing_counted);
  const effectiveOpening = opening ?? suggestedOpening;
  const expectedClosing = effectiveOpening === null ? null : effectiveOpening + cashReceived - cashRefunded - cashPurchases;

  return {
    day,
    opening,
    closingCounted,
    note: row?.note ?? null,
    suggestedOpening,
    cashReceived,
    cashRefunded,
    cashPurchases,
    expectedClosing,
    difference: expectedClosing === null || closingCounted === null ? null : Math.round((closingCounted - expectedClosing) * 100) / 100,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function getRecentCashDays(limit = 14): Promise<{ day: string; opening: number | null; closingCounted: number | null }[]> {
  const { data, error } = await db().from("cash_days").select("day, opening, closing_counted").order("day", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    day: r.day,
    opening: r.opening === null ? null : Number(r.opening),
    closingCounted: r.closing_counted === null ? null : Number(r.closing_counted),
  }));
}

export async function saveCashDay(day: string, opening: number | null, closingCounted: number | null, note: string | null, staffId: string | null): Promise<void> {
  const { error } = await db()
    .from("cash_days")
    .upsert({ day, opening, closing_counted: closingCounted, note, staff_id: staffId, updated_at: new Date().toISOString() });
  if (error) throw error;
}
