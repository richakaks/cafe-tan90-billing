import StaffHeader from "@/components/StaffHeader";
import { getOpenOrders } from "@/lib/data";
import ServeClient from "./ServeClient";

export const dynamic = "force-dynamic";

export default async function ServePage() {
  const orders = await getOpenOrders();

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/serve" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Open orders</h1>
        <p className="mt-1 text-sm text-navy-600">Grouped by table/seat. Updates automatically every few seconds.</p>
        <div className="mt-6">
          <ServeClient initialOrders={orders} />
        </div>
      </main>
    </div>
  );
}
