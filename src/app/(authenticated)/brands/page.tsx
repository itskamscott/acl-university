import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { BRAND_STATUSES } from "@/lib/types";
import { describeFollowup, describeTouchedAge } from "@/lib/utils";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import type { Brand } from "@/lib/types";
import { HelpTooltip } from "@/components/help-tooltip";

export const metadata = { title: "My Brands" };

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; archived?: string }>;
}) {
  const { search, archived } = await searchParams;
  const searchTerm = search?.trim() ?? "";
  const showArchived = archived === "1";

  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  let query = supabase
    .from("brands")
    .select("*")
    .eq("athlete_id", athlete.id);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (searchTerm) {
    const escaped = searchTerm.replace(/[%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    query = query.or(
      `business_name.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern},contact_name.ilike.${pattern}`,
    );
  }

  const { data: brands } = await query
    .order("next_followup_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const brandList = (brands || []) as Brand[];
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
            {showArchived ? "Archived" : "My Brands"}
          </h1>
          {!showArchived && (
            <HelpTooltip text="Every business you're pursuing for a deal lives here. Move them through your pipeline — Prospect → Contacted → Negotiating → Closed — so you always know who's up next." />
          )}
          {showArchived ? (
            <Link
              href="/brands"
              className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
            >
              ← Active brands
            </Link>
          ) : (
            <>
              <Link
                href="/brands/pipeline"
                className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
              >
                Pipeline view
              </Link>
              <Link
                href="/brands?archived=1"
                className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
              >
                Archived
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {brandList.length > 0 && (
            <a
              href="/api/brands/export"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              title="Download brands as CSV"
            >
              <Download className="h-4 w-4" />
              Export
            </a>
          )}
          <Link
            href="/brands/new"
            className="flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
          >
            <Plus className="h-4 w-4" />
            Add Brand
          </Link>
        </div>
      </div>

      <form action="/brands" method="GET" className="mb-4">
        <input
          type="search"
          name="search"
          defaultValue={searchTerm}
          placeholder="Search by name, city, state, or contact"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
        />
      </form>

      {brandList.length === 0 && searchTerm ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">
            No brands match &ldquo;{searchTerm}&rdquo;.
          </p>
          <Link
            href="/brands"
            className="mt-3 inline-block text-sm text-acl-blue hover:underline"
          >
            Clear search
          </Link>
        </div>
      ) : brandList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 md:p-8">
          <div className="max-w-md mx-auto text-center">
            <p className="text-base font-semibold text-acl-black dark:text-zinc-100">
              Build your pipeline
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              The CRM is where every local business you want a deal with lives. Add
              one brand at a time and the Pipeline view shows you who needs follow-up.
            </p>
          </div>

          <ol className="mt-6 space-y-3 max-w-lg mx-auto text-sm">
            <li className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-acl-orange/10 text-xs font-bold text-acl-orange">1</span>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-acl-black dark:text-zinc-100">Pick a local business</span> you actually want to work with. Coffee shops, gyms, restaurants, car washes — anyone visible in your community.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-acl-orange/10 text-xs font-bold text-acl-orange">2</span>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-acl-black dark:text-zinc-100">Add the brand</span> below. Just the name and category to start — fill in the rest as you learn it.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-acl-orange/10 text-xs font-bold text-acl-orange">3</span>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-acl-black dark:text-zinc-100">Log every touchpoint</span>. DM, email, in-person — log it so the assistant can remind you to follow up at the right time.
              </p>
            </li>
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/brands/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
            >
              <Plus className="h-4 w-4" />
              Add your first brand
            </Link>
            <Link
              href="/coach"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Ask the AI Assistant for ideas
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {brandList.map((brand) => {
            const statusLabel = BRAND_STATUSES.find(s => s.value === brand.status)?.label || brand.status;
            const followup = describeFollowup(brand.next_followup_date, today);
            const touched = describeTouchedAge(brand.updated_at, now);
            return (
              <Link
                key={brand.id}
                href={`/brands/${brand.id}`}
                className="flex items-start justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 hover:border-zinc-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">
                    {brand.business_name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">
                    {[brand.city, brand.state].filter(Boolean).join(", ") || brand.category}
                    <span className="mx-1.5 text-zinc-300">·</span>
                    touched {touched}
                  </p>
                </div>
                <div className="shrink-0 ml-3 flex flex-col items-end gap-1.5">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                    {statusLabel}
                  </span>
                  {followup && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        followup.tone === "overdue"
                          ? "bg-red-50 text-red-600"
                          : followup.tone === "today"
                          ? "bg-acl-orange/10 text-acl-orange"
                          : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500"
                      }`}
                    >
                      {followup.tone === "future" ? `Follow up ${followup.label}` : followup.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
