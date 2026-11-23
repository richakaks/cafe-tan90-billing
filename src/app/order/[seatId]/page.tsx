import { getMenuForCustomer, getSeat, getTakeawayFee } from "@/lib/data";
import OrderClient from "./OrderClient";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ seatId: string }> }) {
  const { seatId } = await params;
  const seat = await getSeat(seatId.toUpperCase());

  if (!seat) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold text-navy-950">Table not found</h1>
          <p className="mt-2 text-sm text-navy-700">
            This QR code doesn&rsquo;t match a table or seat at Cafe Tan90. Please ask a staff member for help.
          </p>
        </div>
      </div>
    );
  }

  const [menu, takeawayFee] = await Promise.all([getMenuForCustomer(), getTakeawayFee()]);

  return <OrderClient seat={seat} initialMenu={menu} takeawayFee={takeawayFee} />;
}
