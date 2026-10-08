import Image from "next/image";
import Link from "next/link";
import LowStockAlert from "./LowStockAlert";
import NavStrip from "./NavStrip";

// Round 37: owner's order -- the day's flow, then the manage pages.
const NAV = [
  { href: "/counter", label: "Counter" },
  { href: "/serve", label: "Serve" },
  { href: "/billing", label: "Billing" },
  { href: "/purchases", label: "Purchases" },
  { href: "/cash", label: "Cash" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/analytics", label: "Sales & Analytics" },
  { href: "/guide", label: "Guide" },
];

// Round 33: the header always uses the same width on every page (the owner
// asked for the logo and tabs to stay put when switching pages); maxWidth is
// still accepted so existing callers compile, but no longer changes anything.
export default function StaffHeader({ active }: { active: string; maxWidth?: "max-w-3xl" | "max-w-6xl" }) {
  const maxWidth = "max-w-6xl";
  return (
    <header className="bg-navy-950 text-white">
      <LowStockAlert />
      <div className={`mx-auto ${maxWidth} px-4 py-3 sm:px-6 md:py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="Cafe Tan90"
              width={800}
              height={800}
              className="h-9 w-9 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-100">Cafe Tan90 · Staff</p>
              <nav className="mt-1 hidden flex-wrap gap-x-4 gap-y-1 md:flex">
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
        <NavStrip items={NAV} active={active} />
      </div>
    </header>
  );
}
