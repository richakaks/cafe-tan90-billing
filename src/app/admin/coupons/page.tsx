import StaffHeader from "@/components/StaffHeader";
import { getCouponBatches } from "@/lib/data";
import CouponsClient from "./CouponsClient";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const batches = await getCouponBatches();

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/admin/coupons" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Coupons</h1>
        <p className="mt-1 text-sm text-navy-600">
          Record batches of pre-printed coupons as they&rsquo;re sold, and see how many of each batch are still outstanding.
        </p>
        <div className="mt-6">
          <CouponsClient initialBatches={batches} />
        </div>
      </main>
    </div>
  );
}
