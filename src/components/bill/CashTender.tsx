"use client";

// Round 39: "Customer gave ฿___" with quick note buttons, and the change to
// hand back worked out on the spot. Only the bill amount is ever recorded as
// cash, so the drawer is right without a separate refund step.

export function baht(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `฿${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// Exact, then the notes a customer is likely to hand over.
export function tenderOptions(due: number): number[] {
  if (!(due > 0)) return [];
  const out = [due, Math.ceil(due / 50) * 50, Math.ceil(due / 100) * 100, 500, 1000].filter((v) => v >= due);
  return Array.from(new Set(out.map((v) => Math.round(v * 100) / 100))).slice(0, 4);
}

// The change to give (0 when exact / not entered / short).
export function changeFor(due: number, given: number): number {
  return given > due ? Math.round((given - due) * 100) / 100 : 0;
}

export function ChangeBanner({ amount, label, onDone }: { amount: number; label?: string; onDone: () => void }) {
  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-status-good px-5 py-4 text-white shadow-xl">
      <div>
        {label && <p className="text-xs font-medium opacity-90">{label}</p>}
        <p className="text-2xl font-bold">Give change {baht(amount)}</p>
      </div>
      <button type="button" onClick={onDone} className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold">
        Done
      </button>
    </div>
  );
}

// Controlled "Customer gave" box (counter cart, payment panel, split cash part).
export default function CashTender({
  due,
  given,
  onChange,
  label = "Customer gave",
}: {
  due: number;
  given: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const g = Number(given) || 0;
  const change = changeFor(due, g);
  const short = g > 0 && g < due ? Math.round((due - g) * 100) / 100 : 0;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-navy-700">{label} (optional — for change)</p>
      <div className="flex flex-wrap gap-1.5">
        {tenderOptions(due).map((v, i) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(g === v ? "" : String(v))}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${g === v ? "bg-navy-900 text-white" : "border border-card-border bg-white text-navy-900"}`}
          >
            {i === 0 ? `Exact ${baht(v)}` : baht(v)}
          </button>
        ))}
        <input
          inputMode="decimal"
          value={given}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Other ฿"
          className="w-24 rounded-md border border-card-border bg-white px-2 py-1.5 text-sm"
        />
      </div>
      {change > 0 && <p className="rounded-md bg-green-50 px-3 py-2 text-lg font-bold text-status-good">Give change {baht(change)}</p>}
      {short > 0 && <p className="text-xs font-semibold text-status-low">{baht(short)} short — only {baht(g)} is recorded; the rest stays owed.</p>}
    </div>
  );
}
