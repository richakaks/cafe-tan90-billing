import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-emblem-bg px-6 py-16">
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
      <div className="card relative z-10 w-full max-w-md p-8 text-center">
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

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/serve"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
          >
            Serving Screen
          </Link>
          <Link
            href="/billing"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
          >
            Billing
          </Link>
          <Link
            href="/admin/inventory"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
          >
            Inventory Admin
          </Link>
          <Link
            href="/admin/menu"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
          >
            Menu Admin
          </Link>
          <Link
            href="/admin/coupons"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
          >
            Coupons
          </Link>
          <Link
            href="/admin/analytics"
            className="rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:border-navy-900 hover:bg-navy-100"
          >
            Sales &amp; Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
