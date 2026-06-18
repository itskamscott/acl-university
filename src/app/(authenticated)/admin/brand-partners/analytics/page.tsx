import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_PARTNER_CATEGORIES, type BrandPartner, type BrandPartnerCategory } from "@/lib/types";

export const metadata = { title: "Admin — Brand Vault Analytics" };

interface Reveal {
  brand_partner_id: string;
  revealed_at: string;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export default async function BrandVaultAnalyticsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const since30 = isoDaysAgo(30);
  const since7 = isoDaysAgo(7);

  const [brandsRes, revealsRes, drop30Res] = await Promise.all([
    admin
      .from("brand_partners")
      .select("*")
      .order("display_order", { ascending: true }),
    admin
      .from("reveals")
      .select("brand_partner_id, revealed_at")
      .order("revealed_at", { ascending: false }),
    admin
      .from("brand_drop_emails")
      .select("brand_partner_id, sent_at")
      .gte("sent_at", since30),
  ]);

  const brands = (brandsRes.data ?? []) as BrandPartner[];
  const reveals = (revealsRes.data ?? []) as Reveal[];
  const drops30 = (drop30Res.data ?? []) as { brand_partner_id: string; sent_at: string }[];

  const brandsById = new Map(brands.map((b) => [b.id, b]));

  // Totals.
  const reveals7 = reveals.filter((r) => r.revealed_at >= since7).length;
  const reveals30 = reveals.filter((r) => r.revealed_at >= since30).length;
  const dropsSent30 = drops30.length;

  // Reveals-per-brand (lifetime + last 7d).
  const lifetimeByBrand = new Map<string, number>();
  const recentByBrand = new Map<string, number>();
  for (const r of reveals) {
    lifetimeByBrand.set(r.brand_partner_id, (lifetimeByBrand.get(r.brand_partner_id) ?? 0) + 1);
    if (r.revealed_at >= since7) {
      recentByBrand.set(r.brand_partner_id, (recentByBrand.get(r.brand_partner_id) ?? 0) + 1);
    }
  }

  // Top brands by lifetime reveals.
  const ranked = brands
    .map((b) => ({
      brand: b,
      lifetime: lifetimeByBrand.get(b.id) ?? 0,
      recent: recentByBrand.get(b.id) ?? 0,
    }))
    .sort((a, b) => b.lifetime - a.lifetime);

  // Reveals by category (lifetime).
  const byCategory = new Map<BrandPartnerCategory, number>();
  for (const r of reveals) {
    const b = brandsById.get(r.brand_partner_id);
    if (!b) continue;
    byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + 1);
  }

  // 30-day reveal histogram by day.
  const daily = new Map<string, number>();
  for (let d = 29; d >= 0; d--) {
    const key = dayKey(isoDaysAgo(d));
    daily.set(key, 0);
  }
  for (const r of reveals) {
    if (r.revealed_at < since30) continue;
    const key = dayKey(r.revealed_at);
    if (daily.has(key)) daily.set(key, (daily.get(key) ?? 0) + 1);
  }
  const dailyEntries = Array.from(daily.entries());
  const dailyMax = Math.max(1, ...dailyEntries.map(([, n]) => n));

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="mb-1">
        <Link
          href="/admin/brand-partners"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Brand Vault
        </Link>
      </div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
        Brand Vault Analytics
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        Lifetime + 30-day reveal performance, drop-email coverage, and category mix.
      </p>

      {/* Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Reveals (lifetime)" value={reveals.length} />
        <Stat label="Reveals (30d)" value={reveals30} />
        <Stat label="Reveals (7d)" value={reveals7} />
        <Stat label="Drop emails (30d)" value={dropsSent30} />
      </div>

      {/* Daily histogram */}
      <section className="mb-8">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">
          Reveals per day (last 30)
        </h2>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
          <div className="flex items-end gap-0.5 h-24">
            {dailyEntries.map(([day, count]) => (
              <div
                key={day}
                className="flex-1 group relative"
                title={`${day}: ${count} reveal${count === 1 ? "" : "s"}`}
              >
                <div
                  className="w-full bg-acl-orange/80 hover:bg-acl-orange rounded-sm transition-colors"
                  style={{ height: `${(count / dailyMax) * 100}%`, minHeight: count > 0 ? "2px" : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
            <span>{dailyEntries[0]?.[0]}</span>
            <span>{dailyEntries[dailyEntries.length - 1]?.[0]}</span>
          </div>
        </div>
      </section>

      {/* Top brands */}
      <section className="mb-8">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">
          Brands ranked by reveals
        </h2>
        {ranked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-500">No brands yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
            {ranked.map(({ brand, lifetime, recent }) => (
              <div key={brand.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
                    {brand.name}
                    {!brand.is_active && (
                      <span className="ml-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                        hidden
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {categoryLabel(brand.category)} · {brand.offer_headline}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-acl-black dark:text-zinc-100">{lifetime}</p>
                  <p className="text-[10px] text-zinc-400">
                    {recent} in last 7d
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* By category */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">
          Reveals by category (lifetime)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BRAND_PARTNER_CATEGORIES.map((c) => {
            const count = byCategory.get(c.value) ?? 0;
            return (
              <div
                key={c.value}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3"
              >
                <p className="text-xs text-zinc-500">{c.label}</p>
                <p className="mt-1 text-xl font-bold text-acl-black dark:text-zinc-100">{count}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
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

function categoryLabel(value: BrandPartnerCategory): string {
  return BRAND_PARTNER_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
