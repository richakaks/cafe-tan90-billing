import { getMenuForCustomer, getTakeawayFee } from "@/lib/data";
import PreOrderClient from "./PreOrderClient";

export const dynamic = "force-dynamic";

export default async function PreOrderPage() {
  const [menu, takeawayFee] = await Promise.all([getMenuForCustomer(), getTakeawayFee()]);
  return <PreOrderClient initialMenu={menu} takeawayFee={takeawayFee} />;
}
