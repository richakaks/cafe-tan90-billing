import StaffHeader from "@/components/StaffHeader";
import { getServedOrders } from "@/lib/data";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const orders = await getServedOrders();

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/billing" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Billing</h1>
        <p className="mt-1 text-sm text-navy-600">
          Orders land here once they&rsquo;re marked served. Add a coupon or discount, void a bill, and mark paid by cash, online or split — one order at a time, or a whole table together.
        </p>
        <div className="mt-6">
          <BillingClient initialOrders={orders} />
        </div>
      </main>
    </div>
  );
}
