import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";

export const metadata = { title: "Content Calendar" };

interface CalendarPost {
  id: string;
  title: string | null;
  caption: string | null;
  platform: string;
  status: string;
  planned_for: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseMonth(raw: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (y > 1900 && m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusTone(status: string): string {
  if (status === "posted") return "bg-green-50 text-green-700";
  if (status === "scheduled") return "bg-amber-50 text-amber-700";
  if (status === "drafted") return "bg-blue-50 text-blue-700";
  return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
}

export default async function ContentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonth(monthParam);

  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  // 6-row grid from the first Sunday on/before the 1st of the month.
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - firstDow);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 41);

  const { data: posts } = await supabase
    .from("content_posts")
    .select("id, title, caption, platform, status, planned_for")
    .eq("athlete_id", athlete.id)
    .not("planned_for", "is", null)
    .gte("planned_for", iso(gridStart))
    .lte("planned_for", iso(gridEnd));

  const postsByDay = new Map<string, CalendarPost[]>();
  for (const p of (posts ?? []) as CalendarPost[]) {
    if (!postsByDay.has(p.planned_for)) postsByDay.set(p.planned_for, []);
    postsByDay.get(p.planned_for)!.push(p);
  }

  const cells: {
    date: Date;
    iso: string;
    inMonth: boolean;
    isToday: boolean;
    posts: CalendarPost[];
  }[] = [];
  const todayIso = iso(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dayIso = iso(d);
    cells.push({
      date: d,
      iso: dayIso,
      inMonth: d.getMonth() === month,
      isToday: dayIso === todayIso,
      posts: postsByDay.get(dayIso) ?? [],
    });
  }

  const prevMonth = month === 0 ? `${year - 1}-12` : `${year}-${pad(month)}`;
  const nextMonth = month === 11 ? `${year + 1}-01` : `${year}-${pad(month + 2)}`;
  const monthLabel = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Content Calendar</h1>
          <Link href="/content" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
            List view
          </Link>
          <Link
            href="/content/pipeline"
            className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
          >
            Pipeline view
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

      <div className="flex items-center justify-between mb-3">
        <Link
          href={`/content/calendar?month=${prevMonth}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Link>
        <p className="text-sm font-semibold text-acl-black dark:text-zinc-100">{monthLabel}</p>
        <Link
          href={`/content/calendar?month=${nextMonth}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Desktop: full 7-column month grid */}
      <div className="hidden md:grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 text-center"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.iso}
            className={`min-h-[110px] bg-white dark:bg-zinc-900 p-1.5 ${
              cell.inMonth ? "" : "bg-zinc-50 dark:bg-zinc-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${
                  cell.isToday
                    ? "bg-acl-orange text-white"
                    : cell.inMonth
                    ? "text-acl-black dark:text-zinc-100"
                    : "text-zinc-300"
                }`}
              >
                {cell.date.getDate()}
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {cell.posts.slice(0, 3).map((p) => {
                const label = p.title || (p.caption ? p.caption.slice(0, 40) : "Untitled");
                return (
                  <Link
                    key={p.id}
                    href={`/content/${p.id}`}
                    className={`block rounded px-1.5 py-0.5 text-[10px] font-medium truncate ${statusTone(p.status)}`}
                    title={`${label} — ${p.platform}`}
                  >
                    {label}
                  </Link>
                );
              })}
              {cell.posts.length > 3 && (
                <p className="text-[10px] text-zinc-400 pl-1">
                  +{cell.posts.length - 3} more
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: vertical agenda — days in this month only, with posts or today */}
      <div className="md:hidden space-y-3">
        {cells
          .filter((cell) => cell.inMonth && (cell.posts.length > 0 || cell.isToday))
          .map((cell) => {
            const dayLabel = cell.date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            return (
              <div
                key={cell.iso}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
              >
                <div
                  className={`flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 ${
                    cell.isToday ? "bg-acl-orange/5" : ""
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      cell.isToday ? "text-acl-orange" : "text-zinc-500"
                    }`}
                  >
                    {cell.isToday ? `Today · ${dayLabel}` : dayLabel}
                  </p>
                  <span className="text-[11px] text-zinc-400">
                    {cell.posts.length === 0
                      ? "Nothing planned"
                      : `${cell.posts.length} ${cell.posts.length === 1 ? "post" : "posts"}`}
                  </span>
                </div>
                {cell.posts.length > 0 && (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {cell.posts.map((p) => {
                      const label = p.title || (p.caption ? p.caption.slice(0, 60) : "Untitled");
                      return (
                        <Link
                          key={p.id}
                          href={`/content/${p.id}`}
                          className="flex items-start gap-3 px-3 py-2.5"
                        >
                          <span
                            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone(p.status)}`}
                          >
                            {p.status}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-acl-black dark:text-zinc-100 line-clamp-2">
                              {label}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5 capitalize">{p.platform}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {cells.filter((cell) => cell.inMonth && cell.posts.length > 0).length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">No content planned this month.</p>
            <Link
              href="/content/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
            >
              <Plus className="h-4 w-4" />
              Plan a post
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
