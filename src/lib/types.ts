export type SeatKind = "table" | "counter";

export interface Seat {
  id: string;
  label: string;
  kind: SeatKind;
}

// Round 21: batch-prep = made in-house in a batch (keema, base milks,
// concentrates, sauces -- the same set gen_seed.py's PRIMARIES dict always
// tracked, just now a real persisted column instead of an internal-only
// distinction). raw = a single purchased ingredient.
export type IngredientKind = "batch_prep" | "raw";

export interface Ingredient {
  id: string;
  name: string;
  // Optional supplier/brand name (e.g. "Meiji", "Lays") -- Round 18, shown
  // in small text under the ingredient name, purely informational.
  brand: string | null;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  kind: IngredientKind;
}

export interface MenuItem {
  code: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  // Round 21: customer-facing blurb and an optional photo, both editable
  // from /admin/menu. Null until an owner writes/uploads one.
  description: string | null;
  imageUrl: string | null;
}

export interface MenuItemIngredientLink {
  menuItemCode: string;
  ingredientId: string;
  qtyPerOrder: number;
}

export type AvailabilityStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface MenuItemWithAvailability extends MenuItem {
  status: AvailabilityStatus;
}

export interface CartItem {
  code: string;
  qty: number;
}

export interface PlacedOrderItem {
  code: string;
  name: string;
  qty: number;
  price: number;
}

export interface PlacedOrder {
  orderId: string;
  dailyOrderNumber: number;
  seatId: string;
  orderDate: string;
  items: PlacedOrderItem[];
  total: number;
}

export type OrderStatus = "pending_pickup" | "placed" | "served" | "paid";
export type OrderType = "immediate" | "pre_order";
export type PaymentMethod = "cash" | "online";

export interface OrderItemRow {
  id: number;
  menuItemCode: string;
  itemName: string;
  qty: number;
  priceAtOrder: number;
}

export interface OrderRow {
  id: string;
  dailyOrderNumber: number | null;
  orderDate: string | null;
  seatId: string | null;
  status: OrderStatus;
  orderType: OrderType;
  requestedDate: string | null;
  requestedTime: string | null;
  couponCode: string | null;
  discountAmount: number;
  // Set when staff mark an order paid (Round 17) — Cash or Online, chosen at
  // that moment. Null for any order still open, and for orders paid before
  // this feature existed (never guessed at retroactively).
  paymentMethod: PaymentMethod | null;
  createdAt: string;
  items: OrderItemRow[];
}

export interface PlacedPreOrder {
  orderId: string;
  requestedDate: string;
  requestedTime: string | null;
  items: PlacedOrderItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export interface CouponBatch {
  id: string;
  buyerName: string;
  couponValue: number;
  quantity: number;
  totalCollected: number;
  soldAt: string;
  redeemedCount: number;
}

export interface Coupon {
  code: string;
  batchId: string;
  value: number;
  redeemed: boolean;
  redeemedAt: string | null;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface DailyTotal {
  date: string;
  orderCount: number;
  revenue: number;
}

export interface ItemRanking {
  code: string;
  name: string;
  qty: number;
  revenue: number;
  // true only for historical-sales entries that never matched a current
  // menu item (see historical_sales.menu_item_code in schema.sql) — shown
  // in the UI as "no longer on the menu". Always false/absent for anything
  // backed by a real menu_items row.
  offMenu?: boolean;
}

export interface CategoryTotal {
  category: string;
  revenue: number;
}

export interface ItemPair {
  codeA: string;
  nameA: string;
  codeB: string;
  nameB: string;
  count: number;
}

// Same-length period immediately before the one selected (e.g. the 7 days
// before "last 7 days", or last month for "this month") — powers the
// up/down trend badges on the summary cards. Null when the selected range
// starts so far back that a "previous period" isn't meaningful to compute
// (currently always computed, but kept nullable for future flexibility).
export interface PeriodTotals {
  revenue: number;
  orders: number;
}

export interface HourlyTotal {
  hour: number; // 0-23, Asia/Bangkok local hour
  orderCount: number;
  revenue: number;
}

export interface WeekdayTotal {
  weekday: number; // 0 = Sunday .. 6 = Saturday
  label: string;
  revenue: number;
  // How many calendar dates of this weekday fall within the selected range
  // (counted whether or not they had any sales) — lets the UI show a fair
  // per-weekday average instead of just a total skewed by how many of each
  // weekday happened to fall in the range.
  occurrences: number;
}

export interface CouponSummary {
  discountGiven: number;
  redeemedCount: number;
  redeemedValue: number;
}

// Round 17: cash vs online split for live orders paid within the selected
// range. "unknown" covers orders marked paid before this feature existed —
// deliberately not guessed into cash or online.
export interface PaymentSplit {
  cash: number;
  cashOrders: number;
  online: number;
  onlineOrders: number;
  unknown: number;
  unknownOrders: number;
}

// A separate, much looser signal from the imported historical spreadsheet
// (Round 14/16): how many of its rows had "Cash" written in their own
// payment_note within the range, and how much revenue those rows total.
// This is NOT folded into paymentSplit above — the sheet only ever noted
// "Cash" some of the time (never "Online"), so an absent note doesn't mean
// online, it usually just means unnoted. Shown as a separate FYI figure.
export interface HistoricalCashNote {
  count: number;
  revenue: number;
}

// Round 21: estimated gross profit for the selected period. Live app orders
// only (see the "Profit view next to Revenue" decision in project notes) --
// ingredient cost is the average cost-per-unit from priced restocks
// (stock_adjustments.price_paid) times each recipe's qty, summed per order
// line. Any line whose recipe includes an ingredient with no priced restock
// yet (or has no recipe at all) is excluded from both revenueCounted and
// costCounted rather than guessed at as free -- excludedRevenue/
// excludedLineItems say how much and how many, so the estimate is never a
// silent undercount presented as complete.
export interface ProfitEstimate {
  estimated: number;
  revenueCounted: number;
  costCounted: number;
  excludedRevenue: number;
  excludedLineItems: number;
}

export interface SalesAnalytics {
  from: string;
  to: string;
  totalRevenue: number;
  totalOrders: number;
  dailyTotals: DailyTotal[];
  bestsellers: ItemRanking[];
  leastSellers: ItemRanking[];
  categoryTotals: CategoryTotal[];
  topPairs: ItemPair[];
  // Portion of totalRevenue that came from the imported historical sales
  // log (pre-dates the app) rather than live orders. totalOrders does NOT
  // include these — the source data has no order/seat boundaries, only
  // day-level item x quantity x price lines, so there's nothing honest to
  // count as an "order" for them.
  historicalRevenue: number;
  // The same-length period immediately preceding [from, to] — e.g. from
  // Jul 1-7 this is Jun 24-30. Used for the "vs previous period" badges.
  previousPeriod: PeriodTotals;
  // Live orders only, grouped by hour of day (Asia/Bangkok) — the imported
  // historical log has no time-of-day data to contribute here.
  hourlyTotals: HourlyTotal[];
  // Live + historical revenue combined, grouped by weekday.
  weekdayTotals: WeekdayTotal[];
  couponSummary: CouponSummary;
  paymentSplit: PaymentSplit;
  historicalCashNote: HistoricalCashNote;
  profit: ProfitEstimate;
}

export interface MenuItemAdminView extends MenuItem {
  // How many servings one order of this recipe actually produces (usually
  // 1) -- Round 18, editable from the item's Edit panel, purely
  // informational (nothing currently multiplies stock deduction by it).
  yieldServings: number;
  ingredients: Array<{ ingredientId: string; ingredientName: string; unit: string; qtyPerOrder: number }>;
}

// ---------------------------------------------------------------------------
// Stock adjustment history
// ---------------------------------------------------------------------------

export interface StockAdjustmentRow {
  id: number;
  ingredientId: string;
  ingredientName: string;
  delta: number;
  resultingStock: number;
  pricePaid: number | null;
  createdAt: string;
}

// Most recent *priced* restock (positive delta with a price_paid recorded)
// for one ingredient -- the "last time we bought this, it cost ฿X" note
// shown next to the restock control on /admin/inventory.
export interface LastRestockPrice {
  ingredientId: string;
  delta: number;
  pricePaid: number;
  createdAt: string;
}
