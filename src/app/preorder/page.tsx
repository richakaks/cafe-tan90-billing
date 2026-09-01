import { getMenuForCustomer } from "@/lib/data";
import PreOrderClient from "./PreOrderClient";

export const dynamic = "force-dynamic";

export default async function PreOrderPage() {
  const menu = await getMenuForCustomer();
  return <PreOrderClient initialMenu={menu} />;
}
