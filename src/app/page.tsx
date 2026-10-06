import Image from "next/image";
import Link from "next/link";

// Round 37: owner's order -- the day's flow first, then the manage pages.
const GROUPS = [
  {
    title: "Every day",
    links: [
      { href: "/counter", label: "Counter" },
      { href: "/serve", label: "Serving Screen" },
      { href: "/billing", label: "Billing" },
      { href: "/purchases", label: "Purchases" },
      { href: "/cash", label: "Cash Balance" },
    ],
  },
  {
    title: "Manage",
    links: [
      { href: "/admin/menu", label: "Menu" },
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/coupons", label: "Coupons" },
      { href: "/admin/analytics", label: "Sales & Analytics" },
    ],
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center overflow-hidden bg-emblem-bg px-6 py-16 sm:py-20">
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={800}
        height={800}
        priority
        unoptimized
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 select-none [mask-image:radial-gradient(circle,black_55%,transparent_78%)] sm:h-[620px] sm:w-[620px] [-webkit-mask-image:radial-gradient(circle,black_55%,transparent_78%)]"
      />
      <div className="card relative z-10 my-auto w-full max-w-md p-8 text-center">
        <Image
          src="/logo.png"
          alt="Cafe Tan90"
          width={800}
          height={800}
          priority
          className="mx-auto h-24 w-24 rounded-2xl shadow-sm"
        />
        <h1 className="mt-5 text-2xl font-semibold text-navy-950">Ordering &amp; Inventory</h1>
        <p className="mt-3 text-sm text-navy-700">
          Customers order by scanning the QR code on their table or counter seat — there&rsquo;s no
          public link to browse the menu from here.
        </p>

        <div className="mt-8 space-y-6 text-left">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-navy-600">{group.title}</p>
              <div className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-center text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
