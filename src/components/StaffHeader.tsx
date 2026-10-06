import Image from "next/image";
import Link from "next/link";
import LowStockAlert from "./LowStockAlert";

const NAV = [
  { href: "/counter", label: "Counter" },
  { href: "/cash", label: "Cash" },
  { href: "/purchases", label: "Purchases" },
  { href: "/serve", label: "Serve" },
  { href: "/billing", label: "Billing" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/analytics", label: "Sales & Analytics" },
];

// Round 33: the header always uses the same width on every page (the owner
// asked for the logo and tabs to stay put when switching pages); maxWidth is
// still accepted so existing callers compile, but no longer changes anything.
export default function StaffHeader({ active }: { active: string; maxWidth?: "max-w-3xl" | "max-w-6xl" }) {
  const maxWidth = "max-w-6xl";
  return (
    <header className="bg-navy-950 text-white">
      <LowStockAlert />
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-4 px-6 py-4`}>
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Cafe Tan90"
            width={800}
            height={800}
            className="h-9 w-9 shrink-0 rounded-lg"
          />
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
        </div>
        <form action="/api/staff-logout" method="POST" className="shrink-0">
          <button type="submit" className="text-xs font-medium text-navy-100 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
