"use client";

import { useEffect, useState } from "react";
import type { StaffMember } from "@/lib/types";

// Owner-editable list of staff names. Removing someone just hides them from
// the picker (old orders keep showing who took them).
export default function StaffManager({ onClose, onChanged }: { onClose: () => void; onChanged: (active: StaffMember[]) => void }) {
  const [list, setList] = useState<StaffMember[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/counter/staff?all=1", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setList(data.staff);
      onChanged((data.staff as StaffMember[]).filter((s) => s.active));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not load the list (are you online?).");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the list once when the dialog opens
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("No connection.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy-950">Staff names</h2>
          <button type="button" onClick={onClose} className="text-sm text-navy-600">
            Close
          </button>
        </div>
        <p className="mt-1 text-xs text-navy-600">Staff pick their name once per shift so every order shows who took it.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim() && (await send("/api/counter/staff", "POST", { name }))) setName("");
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New name" className="min-w-0 flex-1 rounded-md border border-card-border px-3 py-2 text-sm" />
          <button disabled={busy || !name.trim()} className="rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-status-out">{error}</p>}
        <ul className="mt-4 divide-y divide-card-border">
          {list === null && <li className="py-2 text-sm text-navy-600">Loading…</li>}
          {list?.length === 0 && <li className="py-2 text-sm text-navy-600">No names yet.</li>}
          {list?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.id === s.id ? (
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-card-border px-2 py-1 text-sm"
                />
              ) : (
                <span className={`text-sm ${s.active ? "text-navy-950" : "text-navy-600 line-through"}`}>{s.name}</span>
              )}
              <span className="flex shrink-0 gap-2">
                {editing?.id === s.id ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (await send(`/api/counter/staff/${s.id}`, "PATCH", { name: editing.name })) setEditing(null);
                      }}
                      className="text-xs font-medium text-navy-900 underline"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="text-xs text-navy-600">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setEditing({ id: s.id, name: s.name })} className="text-xs text-navy-700 underline">
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => send(`/api/counter/staff/${s.id}`, "PATCH", { active: !s.active })}
                      className="text-xs text-navy-700 underline"
                    >
                      {s.active ? "Remove" : "Bring back"}
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
