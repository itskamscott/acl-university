"use client";

import { useState, useTransition } from "react";
import {
  createOrganization,
  setOrgDefaultPercentage,
  updateOrgName,
} from "@/lib/acl-admin-actions";

interface OrgRow {
  id: string;
  name: string;
  default_acl_percentage: number;
  status: string;
  team_count: number;
  athlete_count: number;
}

export function OrgsClient({ orgs }: { orgs: OrgRow[] }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-acl-black dark:text-zinc-100">
            Organizations
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure each university's default ACL percentage.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-acl-orange px-3 py-1.5 text-sm font-semibold text-white hover:bg-acl-orange/90"
          >
            New university
          </button>
        )}
      </header>

      {creating && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm font-semibold mb-2">Add university</p>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Kansas State University"
              className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
            />
            <button
              disabled={pending || !newName.trim()}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await createOrganization(newName);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setNewName("");
                  setCreating(false);
                });
              }}
              className="rounded-md bg-acl-orange px-3 py-2 text-sm font-semibold text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
                setError(null);
              }}
              className="text-sm text-zinc-500 hover:underline"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}

      <ul className="space-y-2">
        {orgs.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-500">
            No universities yet — create the first one.
          </li>
        ) : (
          orgs.map((o) => <OrgRowCard key={o.id} org={o} />)
        )}
      </ul>
    </div>
  );
}

function OrgRowCard({ org }: { org: OrgRow }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(org.name);
  const [editingPct, setEditingPct] = useState(false);
  const [pct, setPct] = useState(org.default_acl_percentage.toString());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
              />
              <button
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const r = await updateOrgName(org.id, name);
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    setEditingName(false);
                  });
                }}
                className="rounded-md bg-acl-orange px-2 py-1 text-xs font-semibold text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setName(org.name);
                  setError(null);
                }}
                className="text-xs text-zinc-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-acl-black dark:text-zinc-100 truncate">
                {org.name}
              </p>
              <button
                onClick={() => setEditingName(true)}
                className="text-xs text-acl-blue hover:underline"
              >
                rename
              </button>
            </div>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            {org.team_count} {org.team_count === 1 ? "team" : "teams"} ·{" "}
            {org.athlete_count} {org.athlete_count === 1 ? "athlete" : "athletes"}
          </p>
        </div>

        {/* Percentage editor */}
        <div className="text-right shrink-0">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Default %</p>
          {editingPct ? (
            <div className="mt-1 flex items-center gap-1 justify-end">
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                autoFocus
                className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm text-right"
              />
              <span className="text-sm text-zinc-500">%</span>
              <button
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const n = parseFloat(pct);
                    if (Number.isNaN(n)) {
                      setError("Invalid number");
                      return;
                    }
                    const r = await setOrgDefaultPercentage(org.id, n);
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    setEditingPct(false);
                  });
                }}
                className="rounded-md bg-acl-orange px-2 py-1 text-xs font-semibold text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingPct(false);
                  setPct(org.default_acl_percentage.toString());
                  setError(null);
                }}
                className="text-xs text-zinc-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2 justify-end">
              <p className="text-lg font-bold text-acl-black dark:text-zinc-100">
                {org.default_acl_percentage}%
              </p>
              <button
                onClick={() => setEditingPct(true)}
                className="text-xs text-acl-blue hover:underline"
              >
                edit
              </button>
            </div>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
