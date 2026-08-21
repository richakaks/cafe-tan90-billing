import StaffHeader from "@/components/StaffHeader";
import { getIngredients, getMenuItemsAdmin } from "@/lib/data";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuAdminPage() {
  const [items, ingredients] = await Promise.all([getMenuItemsAdmin(), getIngredients()]);

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/admin/menu" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Menu &amp; ingredient mapping</h1>
        <p className="mt-1 text-sm text-navy-600">
          Each item&rsquo;s code (e.g. CT001) and its linked ingredients drive both the customer menu and automatic
          stock deduction.
        </p>
        <div className="mt-6">
          <MenuClient initialItems={items} ingredients={ingredients} />
        </div>
      </main>
    </div>
  );
}
