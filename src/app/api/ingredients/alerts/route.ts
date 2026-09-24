import { NextResponse } from "next/server";
import { getIngredients, getRestockSignals } from "@/lib/data";
import { ingredientAlertStatus } from "@/lib/stock";

// Polled by the staff-wide low-stock popup (see components/LowStockAlert.tsx)
// and used to seed the persistent banner on /admin/inventory. Returns only
// ingredients that are currently low or out — the client decides what's "new"
// since acknowledgement is tracked per-browser, not server-side.
//
// Round 27: each alert also carries a restock signal (buy soon / can wait,
// from getRestockSignals() -- last-30-days sales pace) when one exists for
// that ingredient. Fetched for every ingredient rather than just the alerted
// ones since it's one cheap set of queries either way, and filtered down
// to just the ids already in `alerts` before the response goes out.
export async function GET() {
  try {
    const [ingredients, restockSignals] = await Promise.all([getIngredients(), getRestockSignals()]);
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
        restock: restockSignals[a.ingredient.id] ?? null,
      }));
    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("ingredient alerts failed", err);
    return NextResponse.json({ error: "Could not load stock alerts." }, { status: 500 });
  }
}
