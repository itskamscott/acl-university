import Link from "next/link";
import { Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import {
  isProfileCompleteForVault,
  VAULT_MONTHLY_CAP,
  type BrandPartner,
  type Reveal,
} from "@/lib/types";
import { VaultGrid } from "./vault-grid";

export const metadata = { title: "Brand Vault" };

function firstOfNextMonthLabel(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export default async function VaultPage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  // Email verification lives on auth.users, not athletes.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const emailVerified = !!user?.email_confirmed_at;
  const profileComplete = isProfileCompleteForVault(athlete, emailVerified);

  // One query per resource. The brand_partners RLS already filters to active rows.
  const [brandsRes, revealsRes] = await Promise.all([
    supabase
      .from("brand_partners")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("reveals")
      .select("*")
      .eq("athlete_id", athlete.id),
  ]);

  const brands = (brandsRes.data ?? []) as BrandPartner[];
  const reveals = (revealsRes.data ?? []) as Reveal[];

  // Mark this visit so the "new" badge in nav clears on next page load.
  // Fire-and-forget; the user-facing render doesn't depend on it.
  void supabase
    .from("athletes")
    .update({ last_seen_vault_at: new Date().toISOString() })
    .eq("id", athlete.id);

  // Map of brand_partner_id → reveal so cards can show the code immediately on
  // re-visit without another round-trip.
  const revealsByBrand = new Map<string, Reveal>();
  for (const r of reveals) revealsByBrand.set(r.brand_partner_id, r);

  // Reveals counted against the monthly cap = those revealed since UTC month start.
  const now = new Date();
  const monthStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const usedThisMonth = reveals.filter(
    (r) => new Date(r.revealed_at).getTime() >= monthStartUtc,
  ).length;
  const remaining = Math.max(0, VAULT_MONTHLY_CAP - usedThisMonth);
  const resetLabel = firstOfNextMonthLabel(now);

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
            <Gift className="h-6 w-6 text-acl-orange" />
            Brand Vault
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Discount codes and offers from ACL brand partners. Tap to reveal —
            you get {VAULT_MONTHLY_CAP} reveals each month.
          </p>
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs">
        <span className="font-semibold text-acl-black dark:text-zinc-100">
          Monthly reveals: {usedThisMonth}/{VAULT_MONTHLY_CAP} used
        </span>
        <span className="text-zinc-400">·</span>
        <span className="text-zinc-500">Resets {resetLabel}</span>
      </div>

      {!profileComplete && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Complete your profile to unlock the vault
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/80">
            Brands ship and verify offers using your name, sport, school,
            Instagram handle, shipping address, and a verified email.
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-acl-orange/90"
          >
            Open profile settings
          </Link>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
          <Gift className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-acl-black dark:text-zinc-100">
            More offers coming soon
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            We&apos;re curating brand partners every week. Check back here.
          </p>
        </div>
      ) : (
        <VaultGrid
          brands={brands}
          revealsByBrand={Object.fromEntries(revealsByBrand)}
          profileComplete={profileComplete}
          remaining={remaining}
          resetLabel={resetLabel}
        />
      )}
    </div>
  );
}
