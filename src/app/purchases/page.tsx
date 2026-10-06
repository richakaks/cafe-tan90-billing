import StaffHeader from "@/components/StaffHeader";
import { bangkokToday, getStaff } from "@/lib/counter";
import PurchasesClient from "./PurchasesClient";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const staff = await getStaff();
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/purchases" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-navy-950">Purchases</h1>
        <p className="mt-1 text-sm text-navy-600">
          Everything bought for the cafe — small daily buys or a whole Makro bill. Cash taken from the drawer is subtracted on the Cash page; money paid from someone&rsquo;s own pocket is listed below until they&rsquo;re paid back.
        </p>
        <div className="mt-5">
          <PurchasesClient today={bangkokToday()} staff={staff} />
        </div>
      </main>
    </div>
  );
}
