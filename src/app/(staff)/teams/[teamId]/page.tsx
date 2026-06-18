import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";
import { createClient } from "@/lib/supabase/server";
import { ContentIdeasSection } from "./content-ideas-section";

// Mirrors the spec's deal_status walk (migration 022 acl_deal_status enum).
const DEAL_STAGES = [
  "proposed",
  "agreement_attached",
  "acl_review",
  "active",
  "deliverables",
  "paid",
  "cancelled",
] as const;
type DealStage = (typeof DEAL_STAGES)[number];

const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  proposed: "Proposed",
  agreement_attached: "Agreement attached",
  acl_review: "ACL review",
  active: "Active",
  deliverables: "Deliverables",
  paid: "Paid",
  cancelled: "Cancelled",
};

const CONTENT_STAGES = ["idea", "drafted", "scheduled", "posted"] as const;
type ContentStage = (typeof CONTENT_STAGES)[number];

const CONTENT_STAGE_LABEL: Record<ContentStage, string> = {
  idea: "Idea",
  drafted: "Drafted",
  scheduled: "Scheduled",
  posted: "Posted",
};

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDashboard({ params }: PageProps) {
  const { teamId } = await params;
  await getStaffProfileOrRedirect();
  const supabase = await createClient();

  // Single round trip per resource — RLS filters whatever the staffer
  // can't see. notFound() if the team isn't visible.
  const [teamResult, athletesResult, contractsResult, contentResult, managersResult] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, name, sport, organizations ( id, name )")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("athletes")
        .select(
          "id, full_name, sport, school, graduation_year, instagram_handle, last_seen_vault_at, created_at",
        )
        .eq("team_id", teamId)
        .order("full_name", { ascending: true }),
      supabase
        .from("contracts")
        .select("id, athlete_id, acl_status, gross_amount, total_value_cents")
        .eq("team_id", teamId),
      supabase
        .from("content_posts")
        .select("id, athlete_id, status, platform, title, posted_at, planned_for, posted_url")
        .eq("team_id", teamId)
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(50),
      supabase
        .from("team_assignments")
        .select("profile_id, profiles ( id, full_name )")
        .eq("team_id", teamId)
        .eq("kind", "manager"),
    ]);

  const team = teamResult.data;
  if (!team) notFound();

  const athletes = athletesResult.data ?? [];
  const contracts = contractsResult.data ?? [];
  const posts = contentResult.data ?? [];
  const managers = (managersResult.data ?? []) as unknown as Array<{
    profile_id: string;
    profiles: { id: string; full_name: string | null } | null;
  }>;

  // ---------- Aggregations ----------
  const dealsByStage = new Map<DealStage, { count: number; gross: number }>();
  for (const stage of DEAL_STAGES) dealsByStage.set(stage, { count: 0, gross: 0 });
  for (const c of contracts) {
    const stage = (c.acl_status ?? "proposed") as DealStage;
    const bucket = dealsByStage.get(stage)!;
    bucket.count += 1;
    // Prefer the new gross_amount; fall back to legacy total_value_cents.
    const gross =
      typeof c.gross_amount === "number"
        ? c.gross_amount
        : typeof c.total_value_cents === "number"
          ? c.total_value_cents / 100
          : 0;
    bucket.gross += gross;
  }
  const totalGross = Array.from(dealsByStage.values()).reduce((s, b) => s + b.gross, 0);
  const activeDealCount =
    (dealsByStage.get("active")?.count ?? 0) +
    (dealsByStage.get("deliverables")?.count ?? 0);

  const contentByStage = new Map<ContentStage, number>();
  for (const stage of CONTENT_STAGES) contentByStage.set(stage, 0);
  for (const p of posts) {
    const s = (p.status ?? "idea") as ContentStage;
    contentByStage.set(s, (contentByStage.get(s) ?? 0) + 1);
  }
  const inProgressContent =
    (contentByStage.get("idea") ?? 0) +
    (contentByStage.get("drafted") ?? 0) +
    (contentByStage.get("scheduled") ?? 0);

  // Per-athlete rollup for the roster row badges
  const dealCountByAthlete = new Map<string, number>();
  const contentCountByAthlete = new Map<string, number>();
  for (const c of contracts) {
    if (c.acl_status === "active" || c.acl_status === "deliverables") {
      dealCountByAthlete.set(c.athlete_id, (dealCountByAthlete.get(c.athlete_id) ?? 0) + 1);
    }
  }
  for (const p of posts) {
    if (p.status !== "posted") {
      contentCountByAthlete.set(
        p.athlete_id,
        (contentCountByAthlete.get(p.athlete_id) ?? 0) + 1,
      );
    }
  }

  type RawOrg = { id: string; name: string } | null;
  const org = (team.organizations as unknown as RawOrg) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">
            <Link href="/teams" className="hover:underline">Teams</Link>
            {" / "}
            {org?.name ?? "—"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-acl-black dark:text-zinc-100 truncate">
            {team.name}
          </h1>
          <p className="text-sm text-zinc-500">
            {team.sport ?? "Sport not set"}
          </p>
        </div>
      </header>

      {/* Stat strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Athletes" value={athletes.length.toString()} />
        <Stat label="Active deals" value={activeDealCount.toString()} />
        <Stat label="Total gross" value={fmtMoney(totalGross)} />
        <Stat label="Content in-progress" value={inProgressContent.toString()} />
      </section>

      {/* Deal pipeline */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
          Deal pipeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {DEAL_STAGES.map((stage) => {
            const b = dealsByStage.get(stage)!;
            return (
              <div
                key={stage}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                <p className="text-[11px] text-zinc-500">{DEAL_STAGE_LABEL[stage]}</p>
                <p className="mt-0.5 text-lg font-bold text-acl-black dark:text-zinc-100">
                  {b.count}
                </p>
                {b.gross > 0 && (
                  <p className="text-[11px] text-zinc-500">{fmtMoney(b.gross)}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Content board */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
          Content board
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CONTENT_STAGES.map((stage) => (
            <div
              key={stage}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
            >
              <p className="text-[11px] text-zinc-500">{CONTENT_STAGE_LABEL[stage]}</p>
              <p className="mt-0.5 text-lg font-bold text-acl-black dark:text-zinc-100">
                {contentByStage.get(stage) ?? 0}
              </p>
            </div>
          ))}
        </div>
        {posts.length > 0 && (
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
            {posts.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="px-4 py-2 flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
                    {p.title ?? "(untitled)"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {p.platform} · {p.status}
                    {p.posted_at ? ` · posted ${fmtDate(p.posted_at)}` : ""}
                    {!p.posted_at && p.planned_for ? ` · planned ${p.planned_for}` : ""}
                  </p>
                </div>
                {p.posted_url && (
                  <a
                    href={p.posted_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-acl-blue hover:underline shrink-0 ml-3"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Roster */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
          Roster ({athletes.length})
        </h2>
        {athletes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-500">
              No athletes on this team yet. Generate a team-linked invite code in
              the admin area, then send the signup link to your athletes.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
            {athletes.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-acl-black dark:text-zinc-100 truncate">
                    {a.full_name}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {[a.sport, a.graduation_year ? `'${String(a.graduation_year).slice(-2)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {a.instagram_handle ? ` · @${a.instagram_handle}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[11px]">
                  {(dealCountByAthlete.get(a.id) ?? 0) > 0 && (
                    <span className="rounded-full bg-acl-blue/10 text-acl-blue px-2 py-0.5">
                      {dealCountByAthlete.get(a.id)} active deal
                      {dealCountByAthlete.get(a.id)! === 1 ? "" : "s"}
                    </span>
                  )}
                  {(contentCountByAthlete.get(a.id) ?? 0) > 0 && (
                    <span className="rounded-full bg-acl-orange/10 text-acl-orange px-2 py-0.5">
                      {contentCountByAthlete.get(a.id)} in flight
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Team-level content ideas (Phase 6) */}
      <ContentIdeasSection teamId={teamId} />

      {/* Staff on this team */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
          Staff ({managers.length})
        </h2>
        {managers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center text-sm text-zinc-500">
            No managers assigned to this team yet.
          </div>
        ) : (
          <ul className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
            {managers.map((m) => (
              <li key={m.profile_id} className="px-4 py-2 text-sm">
                {m.profiles?.full_name ?? "(unnamed)"}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-zinc-500">
          Staff add/remove UI lands in the next build — for now, manage assignments
          via the database or the admin invite API.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold text-acl-black dark:text-zinc-100">{value}</p>
    </div>
  );
}

function fmtMoney(amount: number): string {
  if (amount === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
