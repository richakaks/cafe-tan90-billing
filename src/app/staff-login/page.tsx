import Image from "next/image";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = next && next.startsWith("/") ? next : "/serve";

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-emblem-bg px-6 py-16">
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={800}
        height={800}
        priority
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 select-none sm:h-[520px] sm:w-[520px]"
      />
      <form action="/api/staff-login" method="POST" className="card relative z-10 w-full max-w-sm p-8 text-center">
        <Image
          src="/logo.png"
          alt="Cafe Tan90"
          width={800}
          height={800}
          priority
          className="mx-auto h-20 w-20 rounded-2xl shadow-sm"
        />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-navy-600">Cafe Tan90 · Staff</p>
        <h1 className="mt-2 text-xl font-semibold text-navy-950">Enter staff PIN</h1>

        <input type="hidden" name="next" value={nextPath} />

        <input
          type="password"
          name="pin"
          inputMode="numeric"
          autoFocus
          autoComplete="off"
          placeholder="PIN"
          className="mt-6 w-full rounded-lg border border-card-border bg-white px-4 py-3 text-center text-lg tracking-widest text-navy-950 outline-none focus:border-navy-600"
        />

        {error && <p className="mt-3 text-sm text-status-out">Incorrect PIN. Try again.</p>}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-navy-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-navy-800"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
