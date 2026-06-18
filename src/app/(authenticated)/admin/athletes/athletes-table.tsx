"use client";

import { useMemo, useState } from "react";
import { GrantButton } from "./grant-button";
import { ATHLETE_TIERS, type AthleteTier } from "@/lib/types";

interface Row {
  id: string;
  full_name: string;
  email: string;
  school: string | null;
  sport: string | null;
  credits: number;
  is_admin: boolean;
  tier: AthleteTier;
}

interface Props {
  athletes: Row[];
}

type TierFilter = AthleteTier | "all";

export function AthletesTable({ athletes }: Props) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const counts = useMemo(() => {
    const c: Record<AthleteTier, number> = {
      member: 0,
      insider: 0,
      lab_partner: 0,
      founder: 0,
    };
    for (const a of athletes) c[a.tier]++;
    return c;
  }, [athletes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes.filter((a) => {
      if (tierFilter !== "all" && a.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.school?.toLowerCase().includes(q) ?? false) ||
        (a.sport?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [athletes, search, tierFilter]);

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill value="all" current={tierFilter} onChange={setTierFilter} label={`All (${athletes.length})`} />
          {ATHLETE_TIERS.map((t) => (
            <FilterPill
              key={t.value}
              value={t.value}
              current={tierFilter}
              onChange={setTierFilter}
              label={`${t.label}s (${counts[t.value]})`}
            />
          ))}
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, school, sport"
        className="w-full mb-3 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No athletes match.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">School</th>
                <th className="px-4 py-2 font-medium">Credits</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((a) => (
                <tr key={a.id} className="text-zinc-700">
                  <td className="px-4 py-2">
                    <p className="font-medium text-acl-black dark:text-zinc-100">
                      {a.full_name}
                      {a.is_admin && (
                        <span className="ml-2 rounded-full bg-acl-orange/10 px-2 py-0.5 text-[10px] font-medium text-acl-orange">
                          admin
                        </span>
                      )}
                      {a.tier !== "member" && a.tier !== "founder" && (
                        <span className="ml-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                          {tierLabel(a.tier)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{a.email}</p>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {[a.sport, a.school].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-semibold ${a.credits === 0 ? "text-red-600" : "text-acl-black dark:text-zinc-100"}`}>
                      {a.credits}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <GrantButton athleteId={a.id} athleteName={a.full_name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function tierLabel(tier: AthleteTier): string {
  return ATHLETE_TIERS.find((t) => t.value === tier)?.label ?? tier;
}

function FilterPill({
  value,
  current,
  onChange,
  label,
}: {
  value: TierFilter;
  current: TierFilter;
  onChange: (v: TierFilter) => void;
  label: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-acl-black text-white dark:bg-acl-orange"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
