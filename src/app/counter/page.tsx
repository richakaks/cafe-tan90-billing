import StaffHeader from "@/components/StaffHeader";
import { db } from "@/lib/supabase";
import { bangkokToday, getCounterDay, getCounterOpenItems, getStaff } from "@/lib/counter";
import CounterClient, { type CounterMenuItem } from "./CounterClient";

export const dynamic = "force-dynamic";

async function getCounterMenu(): Promise<CounterMenuItem[]> {
  const { data, error } = await db().from("menu_items").select("code, name, category, price").eq("active", true).order("sort_order");
  if (error) throw error;
  return (data ?? []).map((m) => ({ code: m.code, name: m.name, category: m.category, price: Number(m.price) }));
}

export default async function CounterPage() {
  const today = bangkokToday();
  const [menu, staff, day, open] = await Promise.all([getCounterMenu(), getStaff(), getCounterDay(today), getCounterOpenItems()]);

  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/counter" maxWidth="max-w-6xl" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-navy-950">Counter</h1>
        <p className="mt-1 text-sm text-navy-600">
          Take orders at the counter instead of the notebook. Works without internet: orders are saved on this tablet and sent when the connection is back.
        </p>
        <div className="mt-5">
          <CounterClient menu={menu} staff={staff} initialDay={day} initialOpen={open} today={today} />
        </div>
      </main>
    </div>
  );
}
