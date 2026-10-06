"use client";

// Round 32: the counter's offline safety net. Every order is written to this
// queue in the browser's own storage BEFORE it's sent, and only removed once
// the server has confirmed it. If the Wi-Fi drops, orders keep piling up
// here (shown as "Pending") and are sent automatically when the connection
// returns. Each order carries a clientKey made on the tablet, so sending the
// same order twice (e.g. the reply was lost) can never create a duplicate.
import type { CounterOrderInput, CounterSyncResult } from "@/lib/counter";

export interface QueuedOrder {
  input: CounterOrderInput;
  // Shown on the order card while it waits for the server.
  display: { total: number; itemsText: string; label: string | null };
  queuedAt: string;
  // A permanent problem (e.g. the day was locked meanwhile) that needs a
  // person -- it stays in the queue, flagged, until someone deletes it.
  error: string | null;
  // True once a send attempt failed because the tablet was offline -- from
  // then on a bad coupon code is parked as "code pending" rather than
  // blocking the order (nobody is standing at the counter to fix it).
  wasOffline: boolean;
}

const QUEUE_KEY = "tan90_counter_queue_v1";

export function readQueue(): QueuedOrder[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(queue: QueuedOrder[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full / blocked: nothing more we can do here; the order is
    // still in memory for this session.
  }
}

export function newClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type SendOutcome =
  | { kind: "offline" }
  | { kind: "unauthorized" }
  | { kind: "results"; results: CounterSyncResult[] };

export async function sendOrders(orders: CounterOrderInput[], fromQueue: boolean): Promise<SendOutcome> {
  try {
    const res = await fetch("/api/counter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders, fromQueue }),
    });
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "offline" };
    const body = (await res.json()) as { results: CounterSyncResult[] };
    return { kind: "results", results: body.results };
  } catch {
    return { kind: "offline" };
  }
}

// Small JSON cache helpers (menu, staff, last-seen day) so the page still
// shows something useful after a reload with no connection.
export function readCache<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
