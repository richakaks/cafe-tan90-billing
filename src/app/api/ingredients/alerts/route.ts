import { NextResponse } from "next/server";
import { getIngredients } from "@/lib/data";
import { ingredientAlertStatus } from "@/lib/stock";

// Polled by the staff-wide low-stock popup (see components/LowStockAlert.tsx)
// and used to seed the persistent banner on /admin/inventory. Returns only
// ingredients that are currently low or out — the client decides what's "new"
// since acknowledgement is tracked per-browser, not server-side.
export async function GET() {
  try {
    const ingredients = await getIngredients();
    const alerts = ingredients
      .map((ing) => ({ ingredient: ing, status: ingredientAlertStatus(ing) }))
      .filter((a): a is { ingredient: typeof ingredients[number]; status: "out_of_stock" | "low_stock" } => a.status !== null)
      .map((a) => ({
        id: a.ingredient.id,
        name: a.ingredient.name,
        unit: a.ingredient.unit,
        currentStock: a.ingredient.currentStock,
        lowStockThreshold: a.ingredient.lowStockThreshold,
        status: a.status,
      }));
    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("ingredient alerts failed", err);
    return NextResponse.json({ error: "Could not load stock alerts." }, { status: 500 });
  }
}
