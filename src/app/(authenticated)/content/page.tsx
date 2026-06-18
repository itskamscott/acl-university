import Link from "next/link";
import { Plus, Clapperboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { CONTENT_PLATFORMS, CONTENT_STATUSES } from "@/lib/types";
import type { ContentPost } from "@/lib/types";
import { HelpTooltip } from "@/components/help-tooltip";

export const metadata = { title: "Content" };

function statusClass(status: string): string {
  switch (status) {
    case "idea":
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
    case "drafted":
      return "bg-blue-50 text-blue-700";
    case "scheduled":
      return "bg-amber-50 text-amber-700";
    case "posted":
      return "bg-green-50 text-green-700";
    default:
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
  }
}

function formatPlanned(date: string | null): string {
  if (!date) return "";
  const today = new Date().toISOString().split("T")[0];
  if (date === today) return "Today";
  if (date < today) return "Past";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  let query = supabase
    .from("content_posts")
    .select("*")
    .eq("athlete_id", athlete.id);

  if (statusFilter && CONTENT_STATUSES.some((s) => s.value === statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data: posts } = await query
    .order("planned_for", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const list = (posts ?? []) as ContentPost[];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Content</h1>
          <HelpTooltip text="Plan, draft, and ship posts across every platform. Track each one from idea → drafted → scheduled → posted." />
          <Link
            href="/content/pipeline"
            className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
          >
            Pipeline view
          </Link>
          <Link
            href="/content/calendar"
            className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
          >
            Calendar
          </Link>
        </div>
        <Link
          href="/content/new"
          className="flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
        >
          <Plus className="h-4 w-4" />
          New Post
        </Link>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        <Link
          href="/content"
          className={`rounded-full px-3 py-1.5 font-medium ${!statusFilter ? "bg-acl-black text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"}`}
        >
          All
        </Link>
        {CONTENT_STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/content?status=${s.value}`}
            className={`rounded-full px-3 py-1.5 font-medium ${
              statusFilter === s.value ? "bg-acl-black text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        statusFilter ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">No {statusFilter} posts.</p>
            <Link
              href="/content"
              className="mt-3 inline-block text-sm text-acl-blue hover:underline"
            >
              See all posts
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 md:p-8">
            <div className="max-w-md mx-auto text-center">
              <Clapperboard className="h-8 w-8 text-acl-orange/70 mx-auto" />
              <p className="mt-3 text-base font-semibold text-acl-black dark:text-zinc-100">
                Build your content engine
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Capture ideas the moment you have them. Draft captions in advance.
                Schedule posts. Mark them posted when they go live so you can see
                your output stacking up.
              </p>
            </div>

            <ol className="mt-6 space-y-3 max-w-lg mx-auto text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-acl-orange/10 text-xs font-bold text-acl-orange">1</span>
                <p className="text-zinc-600 dark:text-zinc-300">
                  <span className="font-medium text-acl-black dark:text-zinc-100">Start with an idea</span>. One line is enough — &ldquo;gameday Reel with shoes&rdquo; works.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-acl-orange/10 text-xs font-bold text-acl-orange">2</span>
                <p className="text-zinc-600 dark:text-zinc-300">
                  <span className="font-medium text-acl-black dark:text-zinc-100">Let the assistant draft the caption</span>. It knows your CRM and can tag the brand for you.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-acl-orange/10 text-xs font-bold text-acl-orange">3</span>
                <p className="text-zinc-600 dark:text-zinc-300">
                  <span className="font-medium text-acl-black dark:text-zinc-100">Mark it posted</span> after it goes live. The community gets a celebration, you get the receipt.
                </p>
              </li>
            </ol>

            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/content/new"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
              >
                <Plus className="h-4 w-4" />
                Capture your first idea
              </Link>
              <Link
                href="/coach"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Ask AI to draft a caption
              </Link>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const platformLabel = CONTENT_PLATFORMS.find((x) => x.value === p.platform)?.label ?? p.platform;
            const statusLabel = CONTENT_STATUSES.find((x) => x.value === p.status)?.label ?? p.status;
            const display = p.title || (p.caption ? p.caption.slice(0, 120) : "Untitled");
            return (
              <Link
                key={p.id}
                href={`/content/${p.id}`}
                className="flex items-start justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 hover:border-zinc-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">{display}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {platformLabel}
                    {p.planned_for && (
                      <>
                        <span className="mx-1.5 text-zinc-300">·</span>
                        {formatPlanned(p.planned_for)}
                      </>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                  {statusLabel}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
