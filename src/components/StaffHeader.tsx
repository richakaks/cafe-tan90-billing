import Link from "next/link";
import LowStockAlert from "./LowStockAlert";

const NAV = [
  { href: "/serve", label: "Serve" },
  { href: "/billing", label: "Billing" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default function StaffHeader({ active }: { active: string }) {
  return (
    <header className="bg-navy-950 text-white">
      <LowStockAlert />
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-100">Cafe Tan90 · Staff</p>
          <nav className="mt-1 flex flex-wrap gap-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium ${active === item.href ? "text-white" : "text-navy-100 hover:text-white"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action="/api/staff-logout" method="POST">
          <button type="submit" className="text-xs font-medium text-navy-100 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
