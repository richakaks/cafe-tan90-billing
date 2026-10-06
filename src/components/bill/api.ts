// Small fetch helper shared by the bill panels (counter cards + Billing).
// Returns null on success, or a message to show.
export async function postJson(url: string, body: unknown, method = "POST"): Promise<{ error: string | null; data: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.ok) return { error: null, data };
    return { error: (data?.error as string) ?? "Something went wrong.", data };
  } catch {
    return { error: "No connection — try again when you're back online.", data: null };
  }
}

export function baht(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `฿${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// What's left on a coupon right now (for the "฿20 left on it" message).
export async function couponLeft(code: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/counter/coupon-check?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return d.found ? Number(d.balance) : null;
  } catch {
    return null;
  }
}
