export type SeatKind = "table" | "counter";

export interface Seat {
  id: string;
  label: string;
  kind: SeatKind;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
}

export interface MenuItem {
  code: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
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
}

export interface MenuItemAdminView extends MenuItem {
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
