import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeTouchedAge } from "@/lib/utils";

export const metadata = { title: "Admin — Analytics" };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default async function AdminAnalyticsPage() {
  const admin = createAdminClient();

  const now = new Date();
  const since7d = isoDaysAgo(7);
  const since30d = isoDaysAgo(30);
  const since24h = isoDaysAgo(1);

  // Top-level counts run in parallel.
  const [
    athletesTotalRes,
    athletesNew7dRes,
    athletesNew30dRes,
    brandsTotalRes,
    brandsNew7dRes,
    outreachTotalRes,
    outreach7dRes,
    contractsTotalRes,
    contractsBySourceRes,
    deliverablesCompletedRes,
    contentTotalRes,
    contentPostedRes,
    coachMessages7dRes,
    coachMessagesTotalRes,
    feedbackTotalRes,
    recentMessagesRes,
    recentBrandsRes,
    recentActivitiesRes,
    recentContentRes,
    creditsConsumed7dRes,
    creditsConsumed30dRes,
    creditsPurchases30dRes,
    athletesListRes,
  ] = await Promise.all([
    admin.from("athletes").select("id", { count: "exact", head: true }),
    admin.from("athletes").select("id", { count: "exact", head: true }).gte("created_at", since7d),
    admin.from("athletes").select("id", { count: "exact", head: true }).gte("created_at", since30d),
    admin.from("brands").select("id", { count: "exact", head: true }),
    admin.from("brands").select("id", { count: "exact", head: true }).gte("created_at", since7d),
    admin.from("brand_activities").select("id", { count: "exact", head: true }).eq("activity_type", "outreach"),
    admin
      .from("brand_activities")
      .select("id", { count: "exact", head: true })
      .eq("activity_type", "outreach")
      .gte("created_at", since7d),
    admin.from("contracts").select("id", { count: "exact", head: true }),
    admin.from("contracts").select("source"),
    admin.from("deliverables").select("id", { count: "exact", head: true }).not("completed_at", "is", null),
    admin.from("content_posts").select("id", { count: "exact", head: true }),
    admin.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "posted"),
    admin
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", since7d),
    admin.from("coach_messages").select("id", { count: "exact", head: true }).eq("role", "user"),
    admin.from("feedback").select("id", { count: "exact", head: true }),
    // Active-athlete union — distinct athlete_ids across the key tables in the last 24h.
    admin.from("coach_messages").select("athlete_id, created_at").gte("created_at", since24h),
    admin.from("brands").select("athlete_id").gte("created_at", since24h),
    admin.from("brand_activities").select("athlete_id").gte("created_at", since24h),
    admin.from("content_posts").select("athlete_id").gte("created_at", since24h),
    admin
      .from("credit_transactions")
      .select("amount")
      .lt("amount", 0)
      .gte("created_at", since7d),
    admin
      .from("credit_transactions")
      .select("amount")
      .lt("amount", 0)
      .gte("created_at", since30d),
    admin
      .from("credit_transactions")
      .select("amount, metadata")
      .eq("reason", "stripe_purchase")
      .gte("created_at", since30d),
    admin
      .from("athletes")
      .select("id, full_name, email, credits, created_at, is_admin")
      .order("created_at", { ascending: false }),
  ]);

  const athletesTotal = athletesTotalRes.count ?? 0;
  const athletesNew7d = athletesNew7dRes.count ?? 0;
  const athletesNew30d = athletesNew30dRes.count ?? 0;
  const brandsTotal = brandsTotalRes.count ?? 0;
  const brandsNew7d = brandsNew7dRes.count ?? 0;
  const outreachTotal = outreachTotalRes.count ?? 0;
  const outreach7d = outreach7dRes.count ?? 0;
  const contractsTotal = contractsTotalRes.count ?? 0;
  const deliverablesCompleted = deliverablesCompletedRes.count ?? 0;
  const contentTotal = contentTotalRes.count ?? 0;
  const contentPosted = contentPostedRes.count ?? 0;
  const coachMessagesTotal = coachMessagesTotalRes.count ?? 0;
  const coachMessages7d = coachMessages7dRes.count ?? 0;
  const feedbackTotal = feedbackTotalRes.count ?? 0;

  const contractsBySource = new Map<string, number>();
  for (const row of contractsBySourceRes.data ?? []) {
    const s = String(row.source);
    contractsBySource.set(s, (contractsBySource.get(s) ?? 0) + 1);
  }

  const activeAthleteIds = new Set<string>();
  for (const r of recentMessagesRes.data ?? []) activeAthleteIds.add(r.athlete_id as string);
  for (const r of recentBrandsRes.data ?? []) activeAthleteIds.add(r.athlete_id as string);
  for (const r of recentActivitiesRes.data ?? []) activeAthleteIds.add(r.athlete_id as string);
  for (const r of recentContentRes.data ?? []) activeAthleteIds.add(r.athlete_id as string);
  const dau = activeAthleteIds.size;

  const creditsConsumed7d = (creditsConsumed7dRes.data ?? []).reduce(
    (acc, r) => acc + Math.abs(r.amount as number),
    0,
  );
  const creditsConsumed30d = (creditsConsumed30dRes.data ?? []).reduce(
    (acc, r) => acc + Math.abs(r.amount as number),
    0,
  );

  const revenue30dCents = (creditsPurchases30dRes.data ?? []).reduce((acc, r) => {
    const metadata = r.metadata as { amount_total?: number } | null;
    return acc + (metadata?.amount_total ?? 0);
  }, 0);

  // Top-active athletes by AI Assistant messages in the last 30d.
  const { data: recent30d } = await admin
    .from("coach_messages")
    .select("athlete_id")
    .eq("role", "user")
    .gte("created_at", since30d);
  const messageCountByAthlete = new Map<string, number>();
  for (const r of recent30d ?? []) {
    const key = r.athlete_id as string;
    messageCountByAthlete.set(key, (messageCountByAthlete.get(key) ?? 0) + 1);
  }

  // Last-touch per athlete across every content-producing table for "most
  // recent activity" — used for both the top-active list and the dormant list.
  const lastTouchByAthlete = new Map<string, Date>();
  function bumpTouch(athleteId: string, isoDate: string) {
    const d = new Date(isoDate);
    const prev = lastTouchByAthlete.get(athleteId);
    if (!prev || d > prev) lastTouchByAthlete.set(athleteId, d);
  }
  const [touchMsgs, touchBrands, touchActs, touchContent, touchContracts] = await Promise.all([
    admin.from("coach_messages").select("athlete_id, created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("brands").select("athlete_id, updated_at").order("updated_at", { ascending: false }).limit(500),
    admin.from("brand_activities").select("athlete_id, created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("content_posts").select("athlete_id, updated_at").order("updated_at", { ascending: false }).limit(500),
    admin.from("contracts").select("athlete_id, updated_at").order("updated_at", { ascending: false }).limit(500),
  ]);
  for (const r of touchMsgs.data ?? []) bumpTouch(r.athlete_id as string, r.created_at as string);
  for (const r of touchBrands.data ?? []) bumpTouch(r.athlete_id as string, r.updated_at as string);
  for (const r of touchActs.data ?? []) bumpTouch(r.athlete_id as string, r.created_at as string);
  for (const r of touchContent.data ?? []) bumpTouch(r.athlete_id as string, r.updated_at as string);
  for (const r of touchContracts.data ?? []) bumpTouch(r.athlete_id as string, r.updated_at as string);

  const athletes = (athletesListRes.data ?? []) as {
    id: string;
    full_name: string;
    email: string;
    credits: number;
    created_at: string;
    is_admin: boolean;
  }[];

  const topActive = athletes
    .map((a) => ({
      ...a,
      messageCount: messageCountByAthlete.get(a.id) ?? 0,
    }))
    .filter((a) => a.messageCount > 0 && !a.is_admin)
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 8);

  const sevenDaysAgoMs = now.getTime() - 7 * 86_400_000;
  const dormant = athletes
    .filter((a) => !a.is_admin)
    .filter((a) => {
      const lastTouch = lastTouchByAthlete.get(a.id);
      return !lastTouch || lastTouch.getTime() < sevenDaysAgoMs;
    })
    .slice(0, 8);

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "Athletes", value: String(athletesTotal), hint: `+${athletesNew7d} in last 7d, +${athletesNew30d} in last 30d` },
    { label: "Active today", value: String(dau), hint: "Did something in the last 24h" },
    { label: "Revenue (30d)", value: dollars(revenue30dCents), hint: "Stripe purchases credited" },
    { label: "Credits burned (7d)", value: String(creditsConsumed7d), hint: `${creditsConsumed30d} in last 30d` },
    { label: "Assistant msgs", value: String(coachMessagesTotal), hint: `${coachMessages7d} in last 7d` },
    { label: "Feedback submissions", value: String(feedbackTotal) },
  ];

  const featureRows = [
    { label: "Brands", value: brandsTotal, sub: `+${brandsNew7d} in last 7d`, href: "/admin/athletes" },
    { label: "Outreach logged", value: outreachTotal, sub: `+${outreach7d} in last 7d` },
    { label: "Contracts", value: contractsTotal, sub: Array.from(contractsBySource.entries()).map(([s, n]) => `${n} ${s}`).join(" · ") },
    { label: "Deliverables completed", value: deliverablesCompleted },
    { label: "Content posts", value: contentTotal, sub: `${contentPosted} posted` },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Analytics</h1>
        <Link href="/admin/invites" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Invites
        </Link>
        <Link href="/admin/athletes" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Athletes
        </Link>
        <Link href="/admin/lab-partners" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Lab Partners
        </Link>
        <Link href="/admin/brand-partners" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Brand Vault
        </Link>
        <Link href="/admin/feedback" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Feedback
        </Link>
      </div>

      {/* Top-level tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
            <p className="text-xs text-zinc-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-acl-black dark:text-zinc-100">{t.value}</p>
            {t.hint && <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{t.hint}</p>}
          </div>
        ))}
      </div>

      {/* Feature engagement */}
      <section className="mb-8">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">Feature engagement</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          {featureRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-acl-black dark:text-zinc-100">{row.label}</p>
                {row.sub && <p className="text-xs text-zinc-400 mt-0.5">{row.sub}</p>}
              </div>
              <p className="text-lg font-semibold text-acl-black dark:text-zinc-100">{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top active athletes */}
        <section>
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">
            Most active (30d Assistant)
          </h2>
          {topActive.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No Assistant usage yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
              {topActive.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-acl-black dark:text-zinc-100 truncate">{a.full_name}</p>
                    <p className="text-xs text-zinc-400 truncate">{a.email}</p>
                  </div>
                  <p className="shrink-0 text-sm text-zinc-600">
                    {a.messageCount} msg{a.messageCount === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Dormant athletes */}
        <section>
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">Dormant (7d+ silent)</h2>
          {dormant.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
              Nobody has gone quiet for a week yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
              {dormant.map((a) => {
                const lastTouch = lastTouchByAthlete.get(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-acl-black dark:text-zinc-100 truncate">{a.full_name}</p>
                      <p className="text-xs text-zinc-400 truncate">{a.email}</p>
                    </div>
                    <p className="shrink-0 text-xs text-zinc-500">
                      {lastTouch ? `last ${describeTouchedAge(lastTouch.toISOString(), now)}` : "never active"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
