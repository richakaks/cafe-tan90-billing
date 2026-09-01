import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Cafe Tan90</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy-950">Ordering &amp; Inventory</h1>
        <p className="mt-3 text-sm text-navy-700">
          Customers order by scanning the QR code on their table or counter seat — there&rsquo;s no
          public link to browse the menu from here.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/serve"
            className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800"
          >
            Serving screen
          </Link>
          <Link
            href="/billing"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-100"
          >
            Billing
          </Link>
          <Link
            href="/admin/inventory"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-100"
          >
            Inventory admin
          </Link>
          <Link
            href="/admin/menu"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-100"
          >
            Menu admin
          </Link>
          <Link
            href="/admin/coupons"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-100"
          >
            Coupons
          </Link>
          <Link
            href="/admin/analytics"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-100"
          >
            Sales &amp; analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
