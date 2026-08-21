import { createHmac, timingSafeEqual } from "crypto";

// Simple shared-PIN gate for /serve and /admin/*, matching the attendance
// app's pattern. The cookie never contains the PIN itself — it's an HMAC
// computed from a separate server-only secret, so it can't be reverse
// engineered from the cookie value even if someone reads it off the wire
// (though everything here is over HTTPS on Vercel anyway).

export const STAFF_COOKIE_NAME = "tan90_staff";
export const STAFF_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

function sessionSecret(): string {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing STAFF_SESSION_SECRET env var (see README.md / .env.example).");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function staffCookieValue(): string {
  return sign("staff-session");
}

export function isValidStaffCookie(value: string | undefined | null): boolean {
  if (!value) return false;
  return constantTimeEquals(value, sign("staff-session"));
}

export function checkPin(pin: string): boolean {
  const expected = process.env.STAFF_PIN;
  if (!expected) {
    throw new Error("Missing STAFF_PIN env var (see README.md / .env.example).");
  }
  return constantTimeEquals(pin, expected);
}
