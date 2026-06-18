import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { BRAND_STATUSES } from "@/lib/types";
import { SKOOL_COMMUNITY_URL } from "@/lib/links";
import type { Brand } from "@/lib/types";
import Link from "next/link";
import { Plus, ArrowRight, Users, Check, Circle } from "lucide-react";
import { WelcomeTour } from "@/components/welcome-tour";
import { TourReplayButton } from "@/components/tour-replay-button";
import { SeedSampleButton } from "./seed-button";

function ChecklistItem({
  done,
  href,
  label,
  hint,
}: {
  done: boolean;
  href: string;
  label: string;
  hint: string;
}) {
  const Icon = done ? Check : Circle;
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            done ? "text-acl-orange" : "text-zinc-300"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              done ? "text-zinc-400 line-through" : "text-acl-black dark:text-zinc-100"
            }`}
          >
            {label}
          </p>
          {!done && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>}
        </div>
      </Link>
    </li>
  );
}

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // Get brands due for follow-up today or overdue
  const { data: followups } = await supabase
    .from("brands")
    .select("*")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null)
    .not("next_followup_date", "is", null)
    .lte("next_followup_date", today)
    .neq("status", "deal_closed")
    .neq("status", "not_a_fit")
    .order("next_followup_date", { ascending: true });

  // Get pipeline counts
  const { data: allBrands } = await supabase
    .from("brands")
    .select("status")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null);

  // Onboarding progress (counts only, cheap HEAD queries)
  const [outreachResult, messagesResult, contractsResult, contentResult] = await Promise.all([
    supabase
      .from("brand_activities")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id)
      .eq("activity_type", "outreach"),
    supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id)
      .eq("role", "user"),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id),
    supabase
      .from("content_posts")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id),
  ]);
  const hasBrand = (allBrands?.length ?? 0) > 0;
  const hasOutreach = (outreachResult.count ?? 0) > 0;
  const hasCoachChat = (messagesResult.count ?? 0) > 0;
  const hasContract = (contractsResult.count ?? 0) > 0;
  const hasContentPost = (contentResult.count ?? 0) > 0;
  const onboardingComplete =
    hasBrand && hasOutreach && hasCoachChat && hasContract && hasContentPost;

  const brandList = (allBrands || []) as { status: string }[];
  const statusCounts = BRAND_STATUSES.map((s) => ({
    ...s,
    count: brandList.filter((b) => b.status === s.value).length,
  }));
  const totalBrands = brandList.length;

  const allFollowups = (followups || []) as Brand[];
  const followupList = allFollowups.slice(0, 5);
  const followupOverflow = allFollowups.length - followupList.length;

  // Upcoming deliverables (not yet complete), next 5 by due date.
  const { data: upcomingDeliverables } = await supabase
    .from("deliverables")
    .select("id, description, due_date, contract_id, contracts(title)")
    .eq("athlete_id", athlete.id)
    .is("completed_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);

  // Upcoming content — drafted or scheduled posts with a planned_for date.
  const { data: upcomingContent } = await supabase
    .from("content_posts")
    .select("id, title, caption, platform, planned_for, status")
    .eq("athlete_id", athlete.id)
    .in("status", ["drafted", "scheduled"])
    .not("planned_for", "is", null)
    .gte("planned_for", today)
    .order("planned_for", { ascending: true })
    .limit(5);
  const contentList = upcomingContent ?? [];

  const deliverableList = (upcomingDeliverables ?? []).map((row) => {
    const contractsRel = (row as { contracts: { title: string } | { title: string }[] | null }).contracts;
    const title = Array.isArray(contractsRel) ? contractsRel[0]?.title : contractsRel?.title;
    return {
      id: row.id as string,
      description: row.description as string,
      due_date: row.due_date as string | null,
      contract_id: row.contract_id as string,
      contract_title: title ?? null,
    };
  });

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const firstName = athlete.full_name?.split(" ")[0] ?? "";
  const activeBrandCount = brandList.filter(
    (b) => b.status !== "deal_closed" && b.status !== "not_a_fit",
  ).length;
  const overdueCount = allFollowups.filter(
    (b) => b.next_followup_date && b.next_followup_date < today,
  ).length;
  const upcomingDeliverableCount = deliverableList.length;

  const heroTiles = [
    {
      label: "Active brands",
      value: activeBrandCount,
      sub: totalBrands === activeBrandCount ? null : `${totalBrands} total`,
      href: "/brands/pipeline",
      tone: "default" as const,
    },
    {
      label: "Follow-ups today",
      value: allFollowups.length,
      sub: overdueCount > 0 ? `${overdueCount} overdue` : null,
      href: "/brands",
      tone: overdueCount > 0 ? ("warn" as const) : ("default" as const),
    },
    {
      label: "Deliverables open",
      value: upcomingDeliverableCount,
      sub: null,
      href: "/contracts",
      tone: "default" as const,
    },
    {
      label: "Content queued",
      value: contentList.length,
      sub: null,
      href: "/content",
      tone: "default" as const,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <WelcomeTour
        athleteCreatedAt={athlete.created_at}
        firstName={firstName || "athlete"}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
            {firstName ? `Hey, ${firstName}` : "Hey"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {todayLabel}
            {(athlete.sport || athlete.school) && (
              <>
                <span className="mx-1.5 text-zinc-300">·</span>
                {[athlete.sport, athlete.school].filter(Boolean).join(" · ")}
              </>
            )}
          </p>
        </div>
        <TourReplayButton />
      </div>

      {/* Hero stat strip */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {heroTiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 md:p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {tile.label}
            </p>
            <p
              className={`mt-1.5 md:mt-2 text-2xl md:text-3xl font-bold tabular-nums tracking-tight ${
                tile.tone === "warn" ? "text-red-600" : "text-acl-black dark:text-zinc-100"
              }`}
            >
              {tile.value}
            </p>
            {tile.sub && (
              <p className={`mt-1 text-xs ${tile.tone === "warn" ? "text-red-500" : "text-zinc-400 dark:text-zinc-500"}`}>
                {tile.sub}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* Onboarding checklist — hidden once all three are done */}
      {!onboardingComplete && (
        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Get started</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Three quick steps to set up your NIL pipeline.
          </p>
          <ul className="mt-3 space-y-2">
            <ChecklistItem
              done={hasBrand}
              href="/brands/new"
              label="Add your first brand"
              hint="Start your target list with any local business you want to work with."
            />
            <ChecklistItem
              done={hasOutreach}
              href={hasBrand ? "/brands" : "/brands/new"}
              label="Log your first outreach"
              hint="Open a brand and tap Log Outreach after you DM, call, or email them."
            />
            <ChecklistItem
              done={hasCoachChat}
              href="/coach"
              label="Chat with your AI Assistant"
              hint="Ask for an outreach draft or how to pitch a specific brand."
            />
            <ChecklistItem
              done={hasContract}
              href="/contracts/new"
              label="Save your first contract"
              hint="Upload a PDF a brand sent you or let the AI Assistant draft one."
            />
            <ChecklistItem
              done={hasContentPost}
              href="/content/new"
              label="Save your first content post"
              hint="Start your content calendar — even a single idea counts."
            />
          </ul>
          {!hasBrand && (
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <SeedSampleButton />
            </div>
          )}
        </div>
      )}

      {/* Follow-up Reminders */}
      <div className="mt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">
          Follow-ups {allFollowups.length > 0 ? `(${allFollowups.length})` : ""}
        </h2>
        {followupList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No follow-ups due. You&apos;re caught up.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {followupList.map((brand) => {
              const isOverdue = brand.next_followup_date! < today;
              return (
                <Link
                  key={brand.id}
                  href={`/brands/${brand.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">{brand.business_name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {[brand.city, brand.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${isOverdue ? "text-red-500" : "text-acl-orange"}`}>
                    {isOverdue ? "Overdue" : "Today"}
                  </span>
                </Link>
              );
            })}
            {followupOverflow > 0 && (
              <Link
                href="/brands"
                className="block rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-center text-xs font-medium text-acl-blue hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                +{followupOverflow} more
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Deliverables */}
      {deliverableList.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
              Upcoming deliverables ({deliverableList.length})
            </h2>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-1 text-xs text-acl-blue hover:underline"
            >
              All contracts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {deliverableList.map((d) => {
              const isOverdue = d.due_date !== null && d.due_date < today;
              const isDueToday = d.due_date === today;
              return (
                <Link
                  key={d.id}
                  href={`/contracts/${d.contract_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">{d.description}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {d.contract_title ?? "Contract"}
                    </p>
                  </div>
                  {d.due_date && (
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        isOverdue ? "text-red-500" : isDueToday ? "text-acl-orange" : "text-zinc-500"
                      }`}
                    >
                      {isOverdue
                        ? "Overdue"
                        : isDueToday
                        ? "Today"
                        : new Date(d.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Content */}
      {contentList.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
              Upcoming content ({contentList.length})
            </h2>
            <Link
              href="/content"
              className="inline-flex items-center gap-1 text-xs text-acl-blue hover:underline"
            >
              All content <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {contentList.map((c) => {
              const isDueToday = c.planned_for === today;
              const display = c.title || (c.caption ? c.caption.slice(0, 60) : "Untitled");
              return (
                <Link
                  key={c.id}
                  href={`/content/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">{display}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 capitalize truncate">
                      {c.platform} · {c.status}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${isDueToday ? "text-acl-orange" : "text-zinc-500"}`}
                  >
                    {isDueToday
                      ? "Today"
                      : c.planned_for
                      ? new Date(c.planned_for).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline Summary */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Pipeline ({totalBrands})</h2>
          <Link href="/brands/pipeline" className="inline-flex items-center gap-1 text-xs text-acl-blue hover:underline">
            View pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {totalBrands === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No brands yet.</p>
            <Link
              href="/brands/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
            >
              <Plus className="h-4 w-4" />
              Add your first brand
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {statusCounts.filter(s => s.count > 0).map((s) => (
              <div key={s.value} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
                <p className="text-lg font-bold text-acl-black dark:text-zinc-100">{s.count}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/brands/new"
            className="flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
          >
            <Plus className="h-4 w-4" />
            Add Brand
          </Link>
          <Link
            href="/brands/pipeline"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            View Pipeline
          </Link>
          <Link
            href="/coach"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Ask AI Assistant
          </Link>
        </div>
      </div>

      {/* Community callout */}
      <a
        href={SKOOL_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 hover:border-acl-orange transition-colors"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-acl-orange/10 text-acl-orange">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-acl-black dark:text-zinc-100">
            Connect with other athletes
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Join the ACL community on Skool for live Q&amp;As, playbooks, and deal shares.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-zinc-400 shrink-0" />
      </a>
    </div>
  );
}
