import StaffHeader from "@/components/StaffHeader";
import { bangkokToday, getCashDay, getRecentCashDays, getStaff } from "@/lib/counter";
import CashClient from "./CashClient";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const today = bangkokToday();
  const [day, recent, staff] = await Promise.all([getCashDay(today), getRecentCashDays(), getStaff()]);
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/cash" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-navy-950">Cash balance</h1>
        <p className="mt-1 text-sm text-navy-600">
          Count the drawer at opening and closing. The app works out what the closing should be from the cash taken that day, so any difference shows straight away.
        </p>
        <div className="mt-6">
          <CashClient initialDay={day} initialRecent={recent} today={today} staff={staff} />
        </div>
      </main>
    </div>
  );
}
