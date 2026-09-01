import StaffHeader from "@/components/StaffHeader";
import { getIngredients, getRecentStockAdjustments } from "@/lib/data";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [ingredients, adjustments] = await Promise.all([getIngredients(), getRecentStockAdjustments()]);

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/admin/inventory" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Inventory</h1>
        <p className="mt-1 text-sm text-navy-600">
          Stock deducts automatically as orders come in. Restock here as deliveries arrive.
        </p>
        <div className="mt-6">
          <InventoryClient initialIngredients={ingredients} initialAdjustments={adjustments} />
        </div>
      </main>
    </div>
  );
}
