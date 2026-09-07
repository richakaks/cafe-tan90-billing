import StaffHeader from "@/components/StaffHeader";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/admin/analytics" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Sales &amp; Analytics</h1>
        <p className="mt-1 text-sm text-navy-600">Daily sales, bestsellers, category breakdown, and item pairings.</p>
        <div className="mt-6">
          <AnalyticsClient />
        </div>
      </main>
    </div>
  );
}
