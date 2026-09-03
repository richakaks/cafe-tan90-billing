// Best-effort extraction of a human-readable detail from a thrown error.
// Supabase/Postgres errors carry their real message in `.message` (and
// sometimes `.details`/`.hint`), but a bare `catch` + generic response
// string throws all of that away. Used by the admin Danger Zone routes so a
// failure surfaces exactly what went wrong (e.g. a missing function or
// table because a schema.sql paste didn't fully apply) instead of an
// undiagnosable "Could not reset orders." with no way to tell why.
export function describeError(err: unknown): string | null {
  if (err && typeof err === "object") {
    const anyErr = err as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [anyErr.message, anyErr.details, anyErr.hint].filter(
      (p): p is string => typeof p === "string" && p.length > 0
    );
    if (parts.length > 0) return parts.join(" — ");
  }
  if (err instanceof Error) return err.message;
  return null;
}
