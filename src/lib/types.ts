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

export type OrderStatus = "placed" | "served";

export interface OrderItemRow {
  id: number;
  menuItemCode: string;
  itemName: string;
  qty: number;
  priceAtOrder: number;
}

export interface OrderRow {
  id: string;
  dailyOrderNumber: number;
  orderDate: string;
  seatId: string;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemRow[];
}

export interface MenuItemAdminView extends MenuItem {
  ingredients: Array<{ ingredientId: string; ingredientName: string; unit: string; qtyPerOrder: number }>;
}
