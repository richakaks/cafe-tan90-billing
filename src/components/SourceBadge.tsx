// Round 32: shows where an order came from -- QR (customer scanned a code)
// or Counter (staff took it on /counter).
export default function SourceBadge({ source }: { source: "qr" | "counter" }) {
  return source === "counter" ? (
    <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-800">Counter</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-low">QR</span>
  );
}

// Round 33: practice order -- never counted in sales, cash or stock.
export function TrialBadge() {
  return <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Trial</span>;
}
