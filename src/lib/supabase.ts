import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are NOT prefixed with
// NEXT_PUBLIC_, so Next.js never bundles them into client-side JS. Every page
// and route handler in this app reads/writes the database from the server —
// nothing runs Supabase queries in the browser, so there's no anon key and
// no client-side RLS to worry about (see supabase/schema.sql for the RLS
// posture: locked down, service role bypasses it as intended).

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local " +
        "and fill in your Supabase project's values (see README.md)."
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cached;
}
