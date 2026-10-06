"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CounterOrderInput } from "@/lib/counter";
import type { CounterDay, CounterOrder, FulfillmentType, PaymentMethod, StaffMember } from "@/lib/types";
import OrderCard, { formatBaht, SourceBadge } from "./OrderCard";
import StaffManager from "./StaffManager";
import { newClientKey, readCache, readQueue, sendOrders, writeCache, writeQueue, type QueuedOrder } from "./queue";

export interface CounterMenuItem {
  code: string;
  name: string;
  category: string;
  price: number;
}

type OpenItems = { pickups: CounterOrder[]; outstanding: CounterOrder[] };

interface CartLine {
  key: string;
  code: string;
  name: string;
  price: number;
  qty: number;
  fulfillmentType: FulfillmentType;
  note: string;
  // Price the line was originally sold at (edit mode keeps it).
  soldPrice?: number;
}

// Round 35: a code coupon covers the bill up to its balance (what's left on
// it); useAmount = staff chose to use less (or, offline, typed its value).
type CartCoupon =
  | { kind: "code"; code: string; balance: number | null; useAmount: number | null }
  | { kind: "pending"; amount: number };

const STAFF_KEY = "tan90_counter_staff_v1";
const MENU_CACHE = "tan90_counter_menu_v1";
const STAFF_CACHE = "tan90_counter_staffs_v1";
const DAY_CACHE = "tan90_counter_day_v1";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function CounterClient({
  menu: serverMenu,
  staff: serverStaff,
  initialDay,
  initialOpen,
  today: serverToday,
}: {
  menu: CounterMenuItem[];
  staff: StaffMember[];
  initialDay: CounterDay;
  initialOpen: OpenItems;
  today: string;
}) {
  const [menu, setMenu] = useState(serverMenu);
  const [staff, setStaff] = useState(serverStaff);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [showStaffManager, setShowStaffManager] = useState(false);
  const [today, setToday] = useState(serverToday);

  const [online, setOnline] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const syncing = useRef(false);

  const [category, setCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [kind, setKind] = useState<"walk_in" | "pre_order">("walk_in");
  const [customerLabel, setCustomerLabel] = useState("");
  const [pickupDate, setPickupDate] = useState(addDays(serverToday, 1));
  const [pickupTime, setPickupTime] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "amount">("pct");
  const [discountValue, setDiscountValue] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [coupons, setCoupons] = useState<CartCoupon[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [pendingCouponInput, setPendingCouponInput] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "online" | "split" | "later">("cash");
  const [splitCash, setSplitCash] = useState("");
  const [splitOnline, setSplitOnline] = useState("");
  const [editing, setEditing] = useState<CounterOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [viewDate, setViewDate] = useState(serverToday);
  const [day, setDay] = useState<CounterDay>(initialDay);
  const [openItems, setOpenItems] = useState<OpenItems>(initialOpen);
  const [lockBusy, setLockBusy] = useState(false);
  const [showVoided, setShowVoided] = useState(false);
  // Round 33: practice mode -- orders go in as TRIAL (never counted).
  const [trialMode, setTrialMode] = useState(false);
  const [trialOrders, setTrialOrders] = useState<CounterOrder[]>([]);

  const loadTrials = useCallback(async () => {
    try {
      const res = await fetch("/api/counter/trial", { cache: "no-store" });
      if (res.ok) setTrialOrders((await res.json()).orders as CounterOrder[]);
    } catch {
      // offline -- keep what we have
    }
  }, []);

  async function clearTrials() {
    if (!window.confirm("Delete all trial orders? (They were never counted anywhere.)")) return;
    await fetch("/api/counter/trial", { method: "DELETE" }).catch(() => null);
    setTrialOrders([]);
    setToast("Trial orders cleared.");
  }

  // ---- boot: restore staff pick, queue, caches; register offline worker ----
  useEffect(() => {
    // Reading the tablet's own storage once on mount (it isn't available
    // during server rendering, so it can't be read in useState's initializer).
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStaffId(window.localStorage.getItem(STAFF_KEY));
    } catch {
      // ignore
    }
    setQueue(readQueue());
    if (serverMenu.length > 0) writeCache(MENU_CACHE, serverMenu);
    else setMenu(readCache<CounterMenuItem[]>(MENU_CACHE) ?? []);
    if (serverStaff.length > 0) writeCache(STAFF_CACHE, serverStaff);
    else setStaff(readCache<StaffMember[]>(STAFF_CACHE) ?? []);
    if (!navigator.onLine) setOnline(false);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/counter-sw.js", { scope: "/counter" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickStaff(id: string | null) {
    setStaffId(id);
    try {
      if (id) window.localStorage.setItem(STAFF_KEY, id);
      else window.localStorage.removeItem(STAFF_KEY);
    } catch {
      // ignore
    }
  }

  // ---- loading the day list ----
  const loadDay = useCallback(
    async (date: string) => {
      try {
        const res = await fetch(`/api/counter/day?date=${date}`, { cache: "no-store" });
        if (res.status === 401) {
          setNeedLogin(true);
          return;
        }
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { day: CounterDay; open: OpenItems };
        setDay(data.day);
        setOpenItems(data.open);
        setOnline(true);
        setNeedLogin(false);
        if (date === today) writeCache(DAY_CACHE, data);
      } catch {
        setOnline(false);
        const cached = readCache<{ day: CounterDay; open: OpenItems }>(DAY_CACHE);
        if (cached && cached.day.summary.date === date) {
          setDay(cached.day);
          setOpenItems(cached.open);
        }
      }
    },
    [today]
  );

  // ---- syncing the offline queue ----
  const syncQueue = useCallback(async () => {
    if (syncing.current) return;
    const current = readQueue();
    const toSend = current.filter((q) => !q.error);
    if (toSend.length === 0) return;
    syncing.current = true;
    try {
      const outcome = await sendOrders(
        toSend.map((q) => q.input),
        true
      );
      if (outcome.kind === "offline") {
        setOnline(false);
        return;
      }
      if (outcome.kind === "unauthorized") {
        setNeedLogin(true);
        return;
      }
      setOnline(true);
      const byKey = new Map(outcome.results.map((r) => [r.clientKey, r]));
      const next: QueuedOrder[] = [];
      let sent = 0;
      for (const q of readQueue()) {
        const r = byKey.get(q.input.clientKey);
        if (!r) {
          next.push(q);
        } else if (r.ok) {
          sent += 1;
        } else if (r.permanent) {
          next.push({ ...q, error: r.error });
        } else {
          next.push(q);
        }
      }
      writeQueue(next);
      setQueue(next);
      if (sent > 0) {
        setToast(`${sent} saved order${sent === 1 ? "" : "s"} sent to the server.`);
        loadDay(viewDate);
      }
    } finally {
      syncing.current = false;
    }
  }, [loadDay, viewDate]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      syncQueue();
      loadDay(viewDate);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const t = setInterval(() => {
      syncQueue();
      loadDay(viewDate);
      loadTrials();
      setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()));
    }, 15000);
    syncQueue();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches trial orders from the server
    loadTrials();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(t);
    };
  }, [syncQueue, loadDay, loadTrials, viewDate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- cart maths ----
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const m of menu) if (!seen.includes(m.category)) seen.push(m.category);
    return ["All", ...seen];
  }, [menu]);

  const gross = cart.reduce((s, l) => s + l.qty * (l.soldPrice ?? l.price), 0);
  const discountNum = Number(discountValue) || 0;
  const manualDiscount = discountMode === "pct" ? round2((gross * Math.min(100, Math.max(0, discountNum))) / 100) : Math.max(0, discountNum);
  // Each coupon takes what it can, in order, never more than the bill left.
  const couponApplied: number[] = [];
  {
    let room = Math.max(0, gross - manualDiscount);
    for (const c of coupons) {
      const cap = c.kind === "pending" ? c.amount : (c.useAmount ?? c.balance ?? 0);
      const take = round2(Math.max(0, Math.min(cap, room)));
      couponApplied.push(take);
      room = round2(room - take);
    }
  }
  const couponTotal = editing ? editing.coupons.reduce((s, c) => s + c.amount, 0) : couponApplied.reduce((s, a) => s + a, 0);
  const toPay = Math.max(0, round2(gross - manualDiscount - couponTotal));
  const unknownCoupon = !editing && coupons.some((c) => c.kind === "code" && c.balance === null && c.useAmount === null);

  const payments: { method: PaymentMethod; amount: number }[] =
    payMode === "cash"
      ? [{ method: "cash", amount: toPay }]
      : payMode === "online"
        ? [{ method: "online", amount: toPay }]
        : payMode === "split"
          ? [
              { method: "cash" as const, amount: Number(splitCash) || 0 },
              { method: "online" as const, amount: Number(splitOnline) || 0 },
            ].filter((p) => p.amount > 0)
          : [];
  const paidNow = payments.reduce((s, p) => s + p.amount, 0);
  const leftUnpaid = round2(toPay - paidNow);

  function addItem(m: CounterMenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.code === m.code && l.fulfillmentType === "dine_in" && !l.note && l.soldPrice === undefined);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key: newClientKey(), code: m.code, name: m.name, price: m.price, qty: 1, fulfillmentType: "dine_in", note: "" }];
    });
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));
  }

  function resetForm() {
    setCart([]);
    setKind("walk_in");
    setCustomerLabel("");
    setPickupDate(addDays(today, 1));
    setPickupTime("");
    setDiscountValue("");
    setDiscountNote("");
    setCoupons([]);
    setCouponInput("");
    setPendingCouponInput("");
    setPayMode("cash");
    setSplitCash("");
    setSplitOnline("");
    setEditing(null);
    setFormError(null);
  }

  async function addCouponCode() {
    const code = couponInput.trim();
    if (!code) return;
    if (coupons.some((c) => c.kind === "code" && c.code.toLowerCase() === code.toLowerCase())) {
      setCouponInput("");
      return;
    }
    let entry: CartCoupon = { kind: "code", code, balance: null, useAmount: null };
    try {
      const res = await fetch(`/api/counter/coupon-check?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        if (!data.found) {
          setFormError(`Coupon ${code} isn't in the system. Check the code, or add it as "code pending".`);
          return;
        }
        if (data.expired) {
          setFormError(`Coupon ${code} expired on ${data.expiresOn}.`);
          return;
        }
        if (data.redeemed) {
          setFormError(`Coupon ${code} is used up (nothing left on it).`);
          return;
        }
        entry = { kind: "code", code, balance: Number(data.balance), useAmount: null };
      }
    } catch {
      // offline: value unknown until synced -- staff can type it below
    }
    setFormError(null);
    setCoupons((prev) => [...prev, entry]);
    setCouponInput("");
  }

  function startEdit(order: CounterOrder) {
    resetForm();
    setEditing(order);
    setCart(
      order.items.map((it) => ({
        key: newClientKey(),
        code: it.menuItemCode,
        name: it.itemName,
        price: it.priceAtOrder,
        soldPrice: it.priceAtOrder,
        qty: it.qty,
        fulfillmentType: it.fulfillmentType,
        note: it.note ?? "",
      }))
    );
    setCustomerLabel(order.customerLabel ?? "");
    if (order.manualDiscountPct) {
      setDiscountMode("pct");
      setDiscountValue(String(order.manualDiscountPct));
    } else if (order.manualDiscountAmount > 0) {
      setDiscountMode("amount");
      setDiscountValue(String(order.manualDiscountAmount));
    }
    setDiscountNote(order.discountNote ?? "");
    if (order.orderType === "pre_order" && order.status === "pending_pickup") {
      setKind("pre_order");
      setPickupDate(order.requestedDate ?? addDays(today, 1));
      setPickupTime(order.requestedTime?.slice(0, 5) ?? "");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setFormError(null);
    if (cart.length === 0) {
      setFormError("Add at least one item.");
      return;
    }
    if (staff.length > 0 && !staffId) {
      setFormError("Pick your name at the top first.");
      return;
    }
    if (kind === "pre_order" && !pickupDate) {
      setFormError("Pick a pickup date.");
      return;
    }
    if (payMode === "split" && leftUnpaid < -0.005) {
      setFormError(`That's ${formatBaht(-leftUnpaid)} more than the bill. Use a refund on the order if change was given back.`);
      return;
    }

    const items = cart.map((l) => ({
      code: l.code,
      qty: l.qty,
      fulfillmentType: l.fulfillmentType,
      note: l.note.trim() || undefined,
      ...(l.soldPrice !== undefined ? { price: l.soldPrice } : {}),
    }));
    const discount =
      discountNum > 0
        ? discountMode === "pct"
          ? { discountPct: discountNum, discountAmount: 0 }
          : { discountPct: null, discountAmount: discountNum }
        : { discountPct: null, discountAmount: 0 };

    setSubmitting(true);
    try {
      if (editing) {
        const res = await fetch(`/api/counter/orders/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId,
            items,
            customerLabel,
            discountNote,
            requestedDate: kind === "pre_order" ? pickupDate : undefined,
            requestedTime: kind === "pre_order" ? pickupTime : undefined,
            ...discount,
          }),
        }).catch(() => null);
        if (!res) {
          setFormError("No connection — editing needs the internet. Try again when you're back online.");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data.error ?? "Could not save the changes.");
          return;
        }
        setToast(`Order ${editing.dailyOrderNumber ? `#${editing.dailyOrderNumber}` : ""} updated.`);
        resetForm();
        loadDay(viewDate);
        return;
      }

      if (trialMode) {
        // Trial: sent straight away, never queued, never counted.
        if (kind === "pre_order") {
          setFormError("Trial orders can only be normal orders, not pre-orders.");
          return;
        }
        if (coupons.some((c) => c.kind === "code")) {
          setFormError('Trial orders can\'t use real coupon codes (that would use them up). Remove them or use "Code later" with a value.');
          return;
        }
        const trialInput: CounterOrderInput = {
          clientKey: newClientKey(),
          clientCreatedAt: new Date().toISOString(),
          staffId,
          kind: "walk_in",
          trial: true,
          customerLabel: customerLabel.trim() || undefined,
          items: items.map(({ code, qty, fulfillmentType, note }) => ({ code, qty, fulfillmentType, note })),
          ...discount,
          discountNote: discountNote.trim() || undefined,
          coupons: coupons.map((c) => (c.kind === "pending" ? { pendingAmount: c.amount } : null)).filter(Boolean) as CounterOrderInput["coupons"],
          payments,
        };
        const out = await sendOrders([trialInput], false);
        if (out.kind === "results" && out.results[0]?.ok) {
          setToast(`TRIAL order #${out.results[0].dailyOrderNumber} placed — it shows on Serve and Billing as TRIAL and is never counted.`);
          resetForm();
          loadTrials();
        } else if (out.kind === "results" && out.results[0] && !out.results[0].ok) {
          setFormError(out.results[0].error);
        } else {
          setFormError("Trial orders need the internet. Try again when you're online.");
        }
        return;
      }

      const input: CounterOrderInput = {
        clientKey: newClientKey(),
        clientCreatedAt: new Date().toISOString(),
        staffId,
        kind,
        customerLabel: customerLabel.trim() || undefined,
        requestedDate: kind === "pre_order" ? pickupDate : undefined,
        requestedTime: kind === "pre_order" ? pickupTime || undefined : undefined,
        items: items.map(({ code, qty, fulfillmentType, note }) => ({ code, qty, fulfillmentType, note })),
        ...discount,
        discountNote: discountNote.trim() || undefined,
        coupons: coupons.map((c) => (c.kind === "code" ? { code: c.code, ...(c.useAmount ? { amount: c.useAmount } : {}) } : { pendingAmount: c.amount })) as CounterOrderInput["coupons"],
        payments,
      };
      const queued: QueuedOrder = {
        input,
        display: {
          total: toPay,
          itemsText: cart.map((l) => `${l.qty}× ${l.name}`).join(", "),
          label: customerLabel.trim() || (kind === "pre_order" ? `Pickup ${pickupDate}` : null),
        },
        queuedAt: input.clientCreatedAt,
        error: null,
        wasOffline: false,
      };
      // Saved on the tablet first, so nothing is lost if the send fails.
      const withNew = [...readQueue(), queued];
      writeQueue(withNew);
      setQueue(withNew);

      const outcome = await sendOrders([input], false);
      if (outcome.kind === "results" && outcome.results[0]?.ok) {
        const r = outcome.results[0];
        const rest = readQueue().filter((q) => q.input.clientKey !== input.clientKey);
        writeQueue(rest);
        setQueue(rest);
        setOnline(true);
        setToast(
          kind === "pre_order"
            ? `Pre-order saved for ${pickupDate}${pickupTime ? ` ${pickupTime}` : ""}.`
            : `Order #${r.dailyOrderNumber} saved.${r.warnings.length ? ` Note: ${r.warnings.join("; ")}` : ""}`
        );
        resetForm();
        loadDay(viewDate);
        return;
      }
      if (outcome.kind === "results" && outcome.results[0] && !outcome.results[0].ok && outcome.results[0].permanent) {
        // Something staff can fix right now (e.g. a coupon already used):
        // keep the cart, drop the queued copy, show the problem.
        const rest = readQueue().filter((q) => q.input.clientKey !== input.clientKey);
        writeQueue(rest);
        setQueue(rest);
        setFormError(outcome.results[0].error);
        return;
      }
      // Offline / server unreachable: it stays queued and is sent later.
      const marked = readQueue().map((q) => (q.input.clientKey === input.clientKey ? { ...q, wasOffline: true } : q));
      writeQueue(marked);
      setQueue(marked);
      if (outcome.kind === "unauthorized") setNeedLogin(true);
      else setOnline(false);
      setToast("Saved on this tablet. It will be sent automatically when the connection is back.");
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  function discardQueued(clientKey: string) {
    if (!window.confirm("Delete this unsent order from the tablet? It has NOT reached the server.")) return;
    const rest = readQueue().filter((q) => q.input.clientKey !== clientKey);
    writeQueue(rest);
    setQueue(rest);
  }

  async function toggleLock() {
    setLockBusy(true);
    try {
      await fetch("/api/counter/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: viewDate, locked: !day.summary.locked, staffId }),
      });
      await loadDay(viewDate);
    } finally {
      setLockBusy(false);
    }
  }

  async function pickedUp(order: CounterOrder) {
    const res = await fetch(`/api/orders/${order.id}/fulfill`, { method: "POST" }).catch(() => null);
    if (!res || !res.ok) {
      setToast("Could not mark it picked up — check the connection.");
      return;
    }
    setToast("Pre-order moved to today's orders.");
    loadDay(viewDate);
  }

  const visibleMenu = category === "All" ? menu : menu.filter((m) => m.category === category);
  const staffName = staff.find((s) => s.id === staffId)?.name ?? null;
  const dayOrders = day.orders.filter((o) => showVoided || o.status !== "void");
  const voidedCount = day.orders.filter((o) => o.status === "void").length;
  const s = day.summary;

  const input = "rounded-md border border-card-border px-2.5 py-2 text-sm";
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${active ? "bg-navy-900 text-white" : "border border-card-border bg-white text-navy-900 hover:bg-navy-100"}`;

  return (
    <div className="space-y-6">
      {/* Top bar: who's taking orders, connection */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-navy-700">Taking orders as</span>
          <select value={staffId ?? ""} onChange={(e) => pickStaff(e.target.value || null)} className={`${input} font-medium`}>
            <option value="">— pick your name —</option>
            {staff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setShowStaffManager(true)} className="text-xs text-navy-700 underline">
            Edit names
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`inline-flex items-center gap-1.5 font-medium ${online ? "text-status-good" : "text-status-out"}`}>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-status-good" : "bg-status-out"}`} />
            {online ? "Online" : "Offline — orders are saved on this tablet"}
          </span>
          {queue.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-status-low">{queue.length} waiting to send</span>}
        </div>
        {needLogin && (
          <p className="w-full text-sm text-status-out">
            Your staff login has expired. Orders are kept on this tablet —{" "}
            <a href="/staff-login?next=/counter" className="underline">
              log in again
            </a>{" "}
            and they&rsquo;ll be sent.
          </p>
        )}
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 ${trialMode ? "border-orange-400 bg-orange-50" : "border-dashed border-card-border"}`}>
        <div className="text-sm">
          {trialMode ? (
            <span className="font-semibold text-orange-700">TRIAL MODE — orders you place now are practice only. They show on Serve and Billing marked TRIAL, and are never counted in sales, cash or stock.</span>
          ) : (
            <span className="text-navy-700">Want to practise? Turn on trial mode to place test orders that are never recorded.</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setTrialMode(!trialMode);
            setKind("walk_in");
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${trialMode ? "bg-orange-600 text-white" : "border border-card-border bg-white text-navy-900"}`}
        >
          {trialMode ? "Turn trial mode off" : "Trial order"}
        </button>
      </div>

      {toast && <div className="rounded-lg bg-navy-900 px-4 py-3 text-sm text-white">{toast}</div>}

      <div className="grid gap-6 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_400px]">
        {/* Menu */}
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleMenu.map((m) => {
              const inCart = cart.filter((l) => l.code === m.code).reduce((s2, l) => s2 + l.qty, 0);
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => addItem(m)}
                  className={`relative min-h-[76px] rounded-xl border p-3 text-left transition active:scale-[0.98] ${inCart ? "border-navy-900 bg-navy-100" : "border-card-border bg-white hover:border-navy-700"}`}
                >
                  <span className="block text-sm font-semibold leading-tight text-navy-950">{m.name}</span>
                  <span className="mt-1 block text-xs text-navy-600">{formatBaht(m.price)}</span>
                  {inCart > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-navy-900 px-1.5 text-xs font-bold text-white">{inCart}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Cart / checkout */}
        <section id="counter-cart" className="card h-fit scroll-mt-4 space-y-4 p-4 md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy-950">
              {editing ? `Editing ${editing.dailyOrderNumber ? `#${editing.dailyOrderNumber}` : "pre-order"}` : "New order"}
            </h2>
            {!editing && (
              <div className="flex rounded-lg border border-card-border p-0.5 text-xs">
                <button type="button" onClick={() => setKind("walk_in")} className={`rounded-md px-2.5 py-1 font-medium ${kind === "walk_in" ? "bg-navy-900 text-white" : "text-navy-800"}`}>
                  Now
                </button>
                <button type="button" disabled={trialMode} onClick={() => setKind("pre_order")} className={`rounded-md px-2.5 py-1 font-medium ${kind === "pre_order" ? "bg-navy-900 text-white" : "text-navy-800"}`}>
                  Pre-order
                </button>
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="rounded-lg bg-navy-100/60 p-4 text-center text-sm text-navy-600">Tap items on the menu to add them.</p>
          ) : (
            <ul className="divide-y divide-card-border">
              {cart.map((l) => (
                <li key={l.key} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-950">{l.name}</p>
                      <p className="text-xs text-navy-600">{formatBaht((l.soldPrice ?? l.price) * l.qty)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => updateLine(l.key, { qty: l.qty - 1 })} className="h-9 w-9 rounded-lg border border-card-border text-lg font-semibold text-navy-900">
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                      <button type="button" onClick={() => updateLine(l.key, { qty: l.qty + 1 })} className="h-9 w-9 rounded-lg border border-card-border text-lg font-semibold text-navy-900">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={l.fulfillmentType === "takeaway"}
                        onChange={(e) => updateLine(l.key, { fulfillmentType: e.target.checked ? "takeaway" : "dine_in" })}
                      />
                      Takeaway
                    </label>
                    <button type="button" onClick={() => setOpenNote(openNote === l.key ? null : l.key)} className="text-navy-700 underline">
                      {l.note ? `Note: ${l.note}` : "Add note"}
                    </button>
                  </div>
                  {openNote === l.key && (
                    <input
                      autoFocus
                      value={l.note}
                      onChange={(e) => updateLine(l.key, { note: e.target.value })}
                      placeholder="e.g. less sweet"
                      className={`${input} mt-1 w-full`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          <input value={customerLabel} onChange={(e) => setCustomerLabel(e.target.value)} placeholder="Customer / group name (optional)" className={`${input} w-full`} />

          {kind === "pre_order" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-navy-700">
                Pickup date
                <input type="date" value={pickupDate} min={today} onChange={(e) => setPickupDate(e.target.value)} className={`${input} mt-0.5 w-full`} />
              </label>
              <label className="text-xs text-navy-700">
                Pickup time
                <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={`${input} mt-0.5 w-full`} />
              </label>
            </div>
          )}

          {/* Discount */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-navy-600">Discount</span>
              <div className="flex rounded-md border border-card-border p-0.5 text-xs">
                <button type="button" onClick={() => setDiscountMode("pct")} className={`rounded px-2 py-0.5 ${discountMode === "pct" ? "bg-navy-900 text-white" : ""}`}>
                  %
                </button>
                <button type="button" onClick={() => setDiscountMode("amount")} className={`rounded px-2 py-0.5 ${discountMode === "amount" ? "bg-navy-900 text-white" : ""}`}>
                  ฿
                </button>
              </div>
              <input inputMode="decimal" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" className={`${input} w-20`} />
              {manualDiscount > 0 && <span className="text-xs text-navy-700">−{formatBaht(manualDiscount)}</span>}
            </div>
            {discountNum > 0 && <input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} placeholder="Why? (optional)" className={`${input} w-full`} />}
          </div>

          {/* Coupons */}
          {editing ? (
            editing.coupons.length > 0 && (
              <p className="text-xs text-navy-700">Coupons on this order: {formatBaht(couponTotal)} (add or fix coupons from the order card).</p>
            )
          ) : (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-navy-600">Coupons</span>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCouponCode();
                    }
                  }}
                  placeholder="Coupon code"
                  className={`${input} min-w-0 flex-1`}
                />
                <button type="button" onClick={addCouponCode} disabled={!couponInput.trim()} className="rounded-md border border-card-border px-3 text-sm font-medium disabled:opacity-40">
                  Add
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  value={pendingCouponInput}
                  onChange={(e) => setPendingCouponInput(e.target.value)}
                  placeholder="No code? Amount off ฿"
                  className={`${input} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  disabled={!(Number(pendingCouponInput) > 0)}
                  onClick={() => {
                    setCoupons((prev) => [...prev, { kind: "pending", amount: Number(pendingCouponInput) }]);
                    setPendingCouponInput("");
                  }}
                  className="rounded-md border border-card-border px-3 text-sm font-medium disabled:opacity-40"
                >
                  Code later
                </button>
              </div>
              {coupons.length > 0 && (
                <ul className="space-y-1">
                  {coupons.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-navy-100/60 px-2 py-1 text-xs">
                      {c.kind === "code" ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <span className="font-medium">{c.code}</span>
                          {c.balance === null ? (
                            <span className="inline-flex items-center gap-1 text-status-low">
                              value?{" "}
                              <input
                                inputMode="decimal"
                                placeholder="฿"
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setCoupons((prev) => prev.map((x, j) => (j === i && x.kind === "code" ? { ...x, useAmount: v > 0 ? v : null } : x)));
                                }}
                                className="w-14 rounded border border-card-border px-1 py-0.5"
                              />
                            </span>
                          ) : (
                            <>
                              <span>−{formatBaht(couponApplied[i] ?? 0)}</span>
                              <span className="text-navy-600">
                                {(() => {
                                  const left = round2(c.balance - (couponApplied[i] ?? 0));
                                  return left > 0.005 ? `· ${formatBaht(left)} stays on it` : "· used up";
                                })()}
                              </span>
                              <span className="inline-flex items-center gap-1 text-navy-600">
                                · use only
                                <input
                                  inputMode="decimal"
                                  placeholder="all"
                                  value={c.useAmount ?? ""}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setCoupons((prev) =>
                                      prev.map((x, j) => (j === i && x.kind === "code" ? { ...x, useAmount: v > 0 ? Math.min(v, x.balance ?? v) : null } : x))
                                    );
                                  }}
                                  className="w-12 rounded border border-card-border px-1 py-0.5"
                                />
                              </span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-status-low">Code pending · −{formatBaht(couponApplied[i] ?? c.amount)}</span>
                      )}
                      <button type="button" onClick={() => setCoupons((prev) => prev.filter((_, j) => j !== i))} className="text-status-out">
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-0.5 border-t border-card-border pt-3 text-sm">
            <div className="flex justify-between text-navy-700">
              <span>Items</span>
              <span>{formatBaht(gross)}</span>
            </div>
            {manualDiscount > 0 && (
              <div className="flex justify-between text-navy-700">
                <span>Discount</span>
                <span>−{formatBaht(manualDiscount)}</span>
              </div>
            )}
            {couponTotal > 0 && (
              <div className="flex justify-between text-navy-700">
                <span>Coupons</span>
                <span>−{formatBaht(couponTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-navy-950">
              <span>To pay</span>
              <span>{formatBaht(toPay)}</span>
            </div>
            {unknownCoupon && <p className="text-xs text-status-low">Offline: type each coupon&rsquo;s value so the total is right. The code is checked when the order is sent.</p>}
          </div>

          {/* Payment */}
          {!editing && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-navy-600">{kind === "pre_order" ? "Paid now (deposit)" : "Payment"}</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ["cash", "Cash"],
                    ["online", "Online"],
                    ["split", "Split"],
                    ["later", kind === "pre_order" ? "At pickup" : "Pay later"],
                  ] as const
                ).map(([mode, label]) => (
                  <button key={mode} type="button" onClick={() => setPayMode(mode)} className={`rounded-lg px-2 py-2 text-sm font-medium ${payMode === mode ? "bg-navy-900 text-white" : "border border-card-border text-navy-900"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {payMode === "split" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-navy-700">
                    Cash ฿
                    <input
                      inputMode="decimal"
                      value={splitCash}
                      onChange={(e) => {
                        setSplitCash(e.target.value);
                        // the rest of the bill fills in as online (still editable)
                        const rest = round2(toPay - (Number(e.target.value) || 0));
                        setSplitOnline(rest > 0 ? String(rest) : "");
                      }}
                      className={`${input} mt-0.5 w-full`}
                    />
                  </label>
                  <label className="text-xs text-navy-700">
                    Online ฿
                    <input inputMode="decimal" value={splitOnline} onChange={(e) => setSplitOnline(e.target.value)} className={`${input} mt-0.5 w-full`} />
                  </label>
                </div>
              )}
              {payMode === "split" && <p className="text-[11px] text-navy-600">Type the cash part — the rest fills in as online.</p>}
              {payMode !== "cash" && payMode !== "online" && leftUnpaid > 0.005 && (
                <p className="text-xs text-status-low">{formatBaht(leftUnpaid)} left to pay later — it&rsquo;ll show in &ldquo;Still owing&rdquo;.</p>
              )}
            </div>
          )}

          {formError && <p className="text-sm text-status-out">{formError}</p>}

          <div className="flex gap-2">
            {(editing || cart.length > 0) && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-card-border px-4 py-3 text-sm font-medium text-navy-900">
                {editing ? "Cancel" : "Clear"}
              </button>
            )}
            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={submit}
              className={`flex-1 rounded-lg px-4 py-3 text-base font-semibold text-white transition disabled:opacity-50 ${trialMode && !editing ? "bg-orange-600 hover:bg-orange-700" : "bg-navy-900 hover:bg-navy-800"}`}
            >
              {submitting ? "Saving…" : editing ? "Save changes" : trialMode ? `Place TRIAL order · ${formatBaht(toPay)}` : kind === "pre_order" ? `Book pre-order · ${formatBaht(toPay)}` : `Place order · ${formatBaht(toPay)}`}
            </button>
          </div>
          {staffName && <p className="text-center text-[11px] text-navy-600">Recorded as taken by {staffName}</p>}
        </section>
      </div>

      {/* Waiting to send */}
      {queue.length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-600">Saved on this tablet, waiting to send ({queue.length})</h2>
          {queue.map((q) => (
            <div key={q.input.clientKey} className={`rounded-lg border p-3 text-sm ${q.error ? "border-status-out bg-red-50" : "border-card-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Pending <SourceBadge source="counter" /> {q.display.label ? `· ${q.display.label}` : ""}
                </span>
                <span className="font-semibold">{formatBaht(q.display.total)}</span>
              </div>
              <p className="text-xs text-navy-700">{q.display.itemsText}</p>
              <p className="text-[11px] text-navy-600">Taken {new Date(q.queuedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}</p>
              {q.error && (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-status-out">Can&rsquo;t be sent: {q.error}</p>
                  <button type="button" onClick={() => discardQueued(q.input.clientKey)} className="text-xs text-status-out underline">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {online && (
            <button type="button" onClick={syncQueue} className="text-xs font-medium text-navy-800 underline">
              Send now
            </button>
          )}
        </section>
      )}

      {/* Trial orders (practice only) */}
      {trialOrders.length > 0 && (
        <section className="card space-y-2 border-2 border-orange-300 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-700">Trial orders ({trialOrders.length}) — not counted</h2>
            <button type="button" onClick={clearTrials} className="rounded-md border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700">
              Clear all trial orders
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {trialOrders.map((o) => (
              <OrderCard key={o.id} order={o} staffId={staffId} today={today} online={online} locked={false} onChanged={() => loadTrials()} onEdit={startEdit} />
            ))}
          </div>
        </section>
      )}

      {/* Pre-orders waiting for pickup */}
      {openItems.pickups.length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-600">Pre-orders to pick up ({openItems.pickups.length})</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {openItems.pickups.map((o) => (
              <div key={o.id} className="space-y-1">
                <OrderCard order={o} staffId={staffId} today={today} online={online} locked={false} onChanged={() => loadDay(viewDate)} onEdit={startEdit} />
                <button type="button" disabled={!online} onClick={() => pickedUp(o)} className="w-full rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Picked up — move to today
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Still owing / coupon codes to fill in */}
      {openItems.outstanding.length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-600">Still owing or coupon code missing ({openItems.outstanding.length})</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {openItems.outstanding.map((o) => (
              <OrderCard key={o.id} order={o} staffId={staffId} today={today} online={online} locked={false} onChanged={() => loadDay(viewDate)} onEdit={startEdit} compact />
            ))}
          </div>
        </section>
      )}

      {/* Day summary + list */}
      <section className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { const d = addDays(viewDate, -1); setViewDate(d); loadDay(d); }} className="rounded-md border border-card-border px-2.5 py-1.5 text-sm">
              ‹
            </button>
            <input type="date" value={viewDate} onChange={(e) => { if (e.target.value) { setViewDate(e.target.value); loadDay(e.target.value); } }} className={input} />
            <button type="button" onClick={() => { const d = addDays(viewDate, 1); setViewDate(d); loadDay(d); }} className="rounded-md border border-card-border px-2.5 py-1.5 text-sm">
              ›
            </button>
            {viewDate !== today && (
              <button type="button" onClick={() => { setViewDate(today); loadDay(today); }} className="text-xs text-navy-700 underline">
                Today
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <a href={`/api/counter/export?date=${viewDate}`} className="font-medium text-navy-800 underline">
              Export (Excel/CSV)
            </a>
            <button type="button" disabled={!online || lockBusy} onClick={toggleLock} className="rounded-md border border-card-border px-2.5 py-1.5 font-medium disabled:opacity-40">
              {s.locked ? "🔒 Locked — unlock" : "Lock this day"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Orders", `${s.orderCount}`, `${s.counterOrders} counter · ${s.qrOrders} QR`],
            ["Sales", formatBaht(s.net), s.discount > 0 ? `after ${formatBaht(s.discount)} discounts/coupons` : ""],
            ["Online", formatBaht(s.onlineReceived), "received this day"],
            ["Cash", formatBaht(s.cashReceived), "received this day"],
            ["Coupon", formatBaht(s.couponTotal), s.pendingCoupons > 0 ? `${s.pendingCoupons} code${s.pendingCoupons === 1 ? "" : "s"} pending` : ""],
            ["Unpaid", formatBaht(s.outstanding), "on this day's orders"],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-lg bg-navy-100/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-600">{label}</p>
              <p className="text-lg font-bold text-navy-950">{value}</p>
              {sub && <p className="text-[11px] text-navy-600">{sub}</p>}
            </div>
          ))}
        </div>

        {dayOrders.length === 0 ? (
          <p className="text-sm text-navy-600">No orders on this day{!online ? " (offline — showing the last saved copy)" : ""}.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {dayOrders.map((o) => (
              <OrderCard key={o.id} order={o} staffId={staffId} today={today} online={online} locked={s.locked} onChanged={() => loadDay(viewDate)} onEdit={startEdit} />
            ))}
          </div>
        )}
        {voidedCount > 0 && (
          <button type="button" onClick={() => setShowVoided(!showVoided)} className="text-xs text-navy-700 underline">
            {showVoided ? "Hide" : "Show"} {voidedCount} voided order{voidedCount === 1 ? "" : "s"}
          </button>
        )}
      </section>

      {/* Phones / small tablets: the order panel sits below the long menu, so
          keep a bar on screen that jumps to it. */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById("counter-cart")?.scrollIntoView({ behavior: "smooth" })}
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-lg md:hidden"
        >
          <span>
            {cart.reduce((n, l) => n + l.qty, 0)} item{cart.reduce((n, l) => n + l.qty, 0) === 1 ? "" : "s"} · {formatBaht(toPay)}
          </span>
          <span>Go to order ↓</span>
        </button>
      )}

      {showStaffManager && (
        <StaffManager
          onClose={() => setShowStaffManager(false)}
          onChanged={(active) => {
            setStaff(active);
            writeCache(STAFF_CACHE, active);
            if (staffId && !active.some((m) => m.id === staffId)) pickStaff(null);
          }}
        />
      )}
    </div>
  );
}
