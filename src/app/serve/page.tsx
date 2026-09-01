import StaffHeader from "@/components/StaffHeader";
import { getOpenOrders, getPendingPreOrders } from "@/lib/data";
import ServeClient from "./ServeClient";

export const dynamic = "force-dynamic";

export default async function ServePage() {
  const [orders, preOrders] = await Promise.all([getOpenOrders(), getPendingPreOrders()]);

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/serve" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Serving</h1>
        <p className="mt-1 text-sm text-navy-600">Open orders grouped by table/seat, plus upcoming pre-orders to fulfill. Updates automatically every few seconds.</p>
        <div className="mt-6">
          <ServeClient initialOrders={orders} initialPreOrders={preOrders} />
        </div>
      </main>
    </div>
  );
}
