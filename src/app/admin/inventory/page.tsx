import StaffHeader from "@/components/StaffHeader";
import {
  getIngredients,
  getRecentStockAdjustments,
  getLastRestockPrices,
  getIngredientRecipeLinks,
  getMenuItemsForDropdown,
} from "@/lib/data";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [ingredients, adjustments, lastRestockPrices, recipeLinks, menuItems] = await Promise.all([
    getIngredients(),
    getRecentStockAdjustments(),
    getLastRestockPrices(),
    getIngredientRecipeLinks(),
    getMenuItemsForDropdown(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/admin/inventory" maxWidth="max-w-6xl" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Inventory</h1>
        <p className="mt-1 text-sm text-navy-600">
          Stock deducts automatically as orders come in. Restock here as deliveries arrive.
        </p>
        <div className="mt-6">
          <InventoryClient
            initialIngredients={ingredients}
            initialAdjustments={adjustments}
            lastRestockPrices={lastRestockPrices}
            recipeLinks={recipeLinks}
            menuItems={menuItems}
          />
        </div>
      </main>
    </div>
  );
}
