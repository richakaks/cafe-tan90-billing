import { NextRequest, NextResponse } from "next/server";
import { addShoppingItems, getShoppingList } from "@/lib/counter";
import { getIngredients } from "@/lib/data";
import { ingredientAlertStatus } from "@/lib/stock";
import { readJson, requireStaff } from "@/lib/requireStaff";

export async function GET(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ items: await getShoppingList() });
  } catch (err) {
    console.error("getShoppingList failed", err);
    return NextResponse.json({ error: "Could not load the list." }, { status: 500 });
  }
}

// Body: { label } to add one thing, or { fromLowStock: true } to add every
// item that is currently low / out of stock.
export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
  const body = await readJson<{ label?: string; ingredientId?: string | null; fromLowStock?: boolean }>(req);
  try {
    if (body?.fromLowStock) {
      const ings = await getIngredients();
      const low = ings.filter((i) => !(i.kind === "supply" && i.lowStockThreshold <= 0) && ingredientAlertStatus(i) !== null);
      await addShoppingItems(
        low.map((i) => ({
          ingredientId: i.id,
          label: i.name,
          note: `${i.currentStock <= 0 ? "out" : "low"}: ${i.currentStock} ${i.unit} left`,
        }))
      );
      return NextResponse.json({ ok: true, added: low.length, items: await getShoppingList() });
    }
    const label = body?.label?.trim();
    if (!label) return NextResponse.json({ error: "Type what to buy." }, { status: 400 });
    await addShoppingItems([{ ingredientId: body?.ingredientId ?? null, label }]);
    return NextResponse.json({ ok: true, items: await getShoppingList() });
  } catch (err) {
    console.error("addShoppingItems failed", err);
    return NextResponse.json({ error: "Could not add to the list." }, { status: 500 });
  }
}
