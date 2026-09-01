import StaffHeader from "@/components/StaffHeader";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default function StockHistoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/admin/inventory" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Stock change history</h1>
        <p className="mt-1 text-sm text-navy-600">
          Every restock, use-up, and order-driven deduction, going back as far as you need.
        </p>
        <div className="mt-6">
          <HistoryClient />
        </div>
      </main>
    </div>
  );
}
