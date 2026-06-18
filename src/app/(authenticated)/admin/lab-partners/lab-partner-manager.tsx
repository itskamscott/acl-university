"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import {
  ATHLETE_TIERS,
  POD_SIZE_MAX,
  POD_SIZE_MIN,
  type AthleteTier,
  type Pod,
  type PodMembership,
} from "@/lib/types";
import {
  addInsiderToPod,
  archivePod,
  createPod,
  removeInsiderFromPod,
  renamePod,
  setAthleteTier,
} from "./actions";

interface AthleteRow {
  id: string;
  full_name: string;
  email: string;
  tier: AthleteTier;
}

interface Props {
  athletes: AthleteRow[];
  pods: Pod[];
  memberships: PodMembership[];
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

type TierFilter = AthleteTier | "all";

export function LabPartnerManager({ athletes, pods, memberships }: Props) {
  const [creatingPod, setCreatingPod] = useState(false);
  const [expandedPodId, setExpandedPodId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [search, setSearch] = useState("");
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();

  const athletesById = useMemo(() => {
    const map = new Map<string, AthleteRow>();
    for (const a of athletes) map.set(a.id, a);
    return map;
  }, [athletes]);

  // Pod -> active members (joined with athlete data)
  const membersByPod = useMemo(() => {
    const map = new Map<string, (PodMembership & { athlete: AthleteRow | undefined })[]>();
    for (const pod of pods) map.set(pod.id, []);
    for (const m of memberships) {
      const arr = map.get(m.pod_id);
      if (arr) arr.push({ ...m, athlete: athletesById.get(m.athlete_id) });
    }
    return map;
  }, [pods, memberships, athletesById]);

  // Insiders not currently in any active pod — eligible to be added.
  const unassignedInsiders = useMemo(() => {
    const assigned = new Set(memberships.map((m) => m.athlete_id));
    return athletes.filter((a) => a.tier === "insider" && !assigned.has(a.id));
  }, [athletes, memberships]);

  const labPartners = useMemo(
    () => athletes.filter((a) => a.tier === "lab_partner"),
    [athletes],
  );

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

  const filteredAthletes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes.filter((a) => {
      if (tierFilter !== "all" && a.tier !== tierFilter) return false;
      if (q && !a.full_name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [athletes, tierFilter, search]);

  function handleCreatePod(name: string, labPartnerId: string) {
    startTransition(async () => {
      const result = await createPod({ name, labPartnerId });
      if (!result.ok) notify(result.error, "error");
      else {
        notify("Pod created.", "success");
        setCreatingPod(false);
      }
    });
  }

  function handleArchivePod(pod: Pod) {
    const memberCount = membersByPod.get(pod.id)?.length ?? 0;
    const confirmed = window.confirm(
      memberCount > 0
        ? `Archive "${pod.name}"? ${memberCount} Insider${memberCount === 1 ? "" : "s"} will be removed from the pod (their tier stays Insider).`
        : `Archive "${pod.name}"?`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await archivePod(pod.id);
      if (!result.ok) notify(result.error, "error");
      else notify("Pod archived.", "success");
    });
  }

  function handleRenamePod(podId: string, name: string) {
    startTransition(async () => {
      const result = await renamePod(podId, name);
      if (!result.ok) notify(result.error, "error");
      else notify("Pod renamed.", "success");
    });
  }

  function handleAddInsider(podId: string, athleteId: string) {
    startTransition(async () => {
      const result = await addInsiderToPod({ podId, athleteId });
      if (!result.ok) notify(result.error, "error");
      else notify("Insider added.", "success");
    });
  }

  function handleRemoveInsider(membershipId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this pod?`)) return;
    startTransition(async () => {
      const result = await removeInsiderFromPod(membershipId);
      if (!result.ok) notify(result.error, "error");
      else notify("Insider removed.", "success");
    });
  }

  function handleSetTier(athleteId: string, tier: AthleteTier) {
    startTransition(async () => {
      const result = await setAthleteTier(athleteId, tier);
      if (!result.ok) notify(result.error, "error");
      else notify("Tier updated.", "success");
    });
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Members" value={counts.member} />
        <Stat label="Insiders" value={counts.insider} />
        <Stat label="Lab Partners" value={counts.lab_partner} />
        <Stat label="Active pods" value={pods.length} />
      </div>

      {/* Pods */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
            Pods
          </h2>
          <button
            type="button"
            onClick={() => setCreatingPod(true)}
            disabled={labPartners.length === 0}
            title={labPartners.length === 0 ? "Promote an athlete to Lab Partner first" : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New pod
          </button>
        </div>

        {creatingPod && (
          <NewPodForm
            labPartners={labPartners}
            saving={isPending}
            onCancel={() => setCreatingPod(false)}
            onSubmit={handleCreatePod}
          />
        )}

        {pods.length === 0 && !creatingPod ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">
              No active pods. {labPartners.length === 0 ? "Promote an athlete to Lab Partner first, then create a pod." : "Create one to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pods.map((pod) => {
              const lp = athletesById.get(pod.lab_partner_id);
              const members = membersByPod.get(pod.id) ?? [];
              const expanded = expandedPodId === pod.id;
              return (
                <PodRow
                  key={pod.id}
                  pod={pod}
                  lp={lp}
                  members={members}
                  expanded={expanded}
                  disabled={isPending}
                  unassignedInsiders={unassignedInsiders}
                  onToggle={() => setExpandedPodId(expanded ? null : pod.id)}
                  onRename={(name) => handleRenamePod(pod.id, name)}
                  onArchive={() => handleArchivePod(pod)}
                  onAddInsider={(athleteId) => handleAddInsider(pod.id, athleteId)}
                  onRemoveInsider={(membershipId, name) =>
                    handleRemoveInsider(membershipId, name)
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Athletes */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
            Athletes
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <TierFilterPill value="all" current={tierFilter} onChange={setTierFilter} label={`All (${athletes.length})`} />
            {ATHLETE_TIERS.map((t) => (
              <TierFilterPill
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
          placeholder="Search by name or email"
          className={`${inputClass} mb-3`}
        />

        {filteredAthletes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-500">No athletes match.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredAthletes.map((a) => {
              const podMembership = memberships.find((m) => m.athlete_id === a.id);
              const podName = podMembership
                ? pods.find((p) => p.id === podMembership.pod_id)?.name ?? null
                : null;
              return (
                <AthleteRowEl
                  key={a.id}
                  athlete={a}
                  podName={podName}
                  disabled={isPending}
                  onTierChange={(tier) => handleSetTier(a.id, tier)}
                />
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-acl-black dark:text-zinc-100">{value}</p>
    </div>
  );
}

function TierFilterPill({
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

function NewPodForm({
  labPartners,
  saving,
  onCancel,
  onSubmit,
}: {
  labPartners: AthleteRow[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (name: string, labPartnerId: string) => void;
}) {
  const [name, setName] = useState("");
  const [labPartnerId, setLabPartnerId] = useState(labPartners[0]?.id ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !labPartnerId) return;
    onSubmit(name, labPartnerId);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 mb-3"
    >
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Pod name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cohort 1, Spring '26, etc."
            className={inputClass}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Lab Partner
          </label>
          <select
            value={labPartnerId}
            onChange={(e) => setLabPartnerId(e.target.value)}
            className={inputClass}
            required
          >
            {labPartners.map((lp) => (
              <option key={lp.id} value={lp.id}>
                {lp.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create pod"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function PodRow({
  pod,
  lp,
  members,
  expanded,
  disabled,
  unassignedInsiders,
  onToggle,
  onRename,
  onArchive,
  onAddInsider,
  onRemoveInsider,
}: {
  pod: Pod;
  lp: AthleteRow | undefined;
  members: (PodMembership & { athlete: AthleteRow | undefined })[];
  expanded: boolean;
  disabled: boolean;
  unassignedInsiders: AthleteRow[];
  onToggle: () => void;
  onRename: (name: string) => void;
  onArchive: () => void;
  onAddInsider: (athleteId: string) => void;
  onRemoveInsider: (membershipId: string, name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(pod.name);
  const [addingInsiderId, setAddingInsiderId] = useState("");

  const count = members.length;
  const sizeWarning =
    count < POD_SIZE_MIN
      ? `below ${POD_SIZE_MIN}`
      : count > POD_SIZE_MAX
      ? `above ${POD_SIZE_MAX}`
      : null;

  function commitRename() {
    setEditingName(false);
    if (name.trim() && name.trim() !== pod.name) onRename(name);
    else setName(pod.name);
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setName(pod.name);
                  setEditingName(false);
                }
              }}
              autoFocus
              className={inputClass}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-sm font-bold tracking-tight text-acl-black dark:text-zinc-100 hover:underline"
            >
              {pod.name}
            </button>
          )}
          <p className="mt-0.5 text-xs text-zinc-500">
            Lab Partner:{" "}
            <span className="text-zinc-700 dark:text-zinc-200 font-medium">
              {lp?.full_name ?? "(unknown)"}
            </span>
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            sizeWarning
              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
          }`}
        >
          {count}/{POD_SIZE_MAX}
          {sizeWarning ? ` ⚠ ${sizeWarning}` : ""}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-3 space-y-3">
          {members.length === 0 ? (
            <p className="text-xs text-zinc-500">No Insiders in this pod yet.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
                      {m.athlete?.full_name ?? "(unknown)"}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{m.athlete?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveInsider(m.id, m.athlete?.full_name ?? "this Insider")}
                    disabled={disabled}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 disabled:opacity-50"
                    aria-label="Remove from pod"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add Insider */}
          {unassignedInsiders.length > 0 ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Add Insider to pod
                </label>
                <select
                  value={addingInsiderId}
                  onChange={(e) => setAddingInsiderId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select an Insider...</option>
                  {unassignedInsiders.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (addingInsiderId) {
                    onAddInsider(addingInsiderId);
                    setAddingInsiderId("");
                  }
                }}
                disabled={disabled || !addingInsiderId}
                className="rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              No Insiders are currently unassigned. Promote a Member to Insider to grow this pod.
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onArchive}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/40 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Archive pod
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AthleteRowEl({
  athlete,
  podName,
  disabled,
  onTierChange,
}: {
  athlete: AthleteRow;
  podName: string | null;
  disabled: boolean;
  onTierChange: (tier: AthleteTier) => void;
}) {
  const isFounder = athlete.tier === "founder";
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
          {athlete.full_name}
        </p>
        <p className="text-xs text-zinc-400 truncate">
          {athlete.email}
          {podName && (
            <>
              <span className="mx-1.5 text-zinc-300">·</span>
              Pod: <span className="text-zinc-600 dark:text-zinc-300">{podName}</span>
            </>
          )}
        </p>
      </div>
      <select
        value={athlete.tier}
        onChange={(e) => onTierChange(e.target.value as AthleteTier)}
        disabled={disabled || isFounder}
        title={isFounder ? "Founders are managed via is_admin" : undefined}
        className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 disabled:opacity-50"
      >
        {ATHLETE_TIERS.map((t) => (
          <option key={t.value} value={t.value} disabled={t.value === "founder" && !isFounder}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
