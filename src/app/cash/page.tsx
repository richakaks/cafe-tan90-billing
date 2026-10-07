import StaffHeader from "@/components/StaffHeader";
import { bangkokToday, getCashDay, getFlaggedCashDays, getRecentCashDays, getStaff } from "@/lib/counter";
import CashClient from "./CashClient";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const today = bangkokToday();
  const [day, recent, staff, flagged] = await Promise.all([getCashDay(today), getRecentCashDays(), getStaff(), getFlaggedCashDays()]);
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/cash" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Cash balance</h1>
        <p className="mt-1 text-sm text-navy-600">
          Count the drawer at opening and closing. The app suggests what the closing should be (opening + cash taken − change − refunds − drawer purchases). Staff still count and enter the real closing; a difference is flagged until someone resolves it with a reason.
        </p>
        <div className="mt-6">
          <CashClient initialDay={day} initialRecent={recent} initialFlagged={flagged} today={today} staff={staff} />
        </div>
      </main>
    </div>
  );
}
