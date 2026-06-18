"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Lock, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { BRAND_PARTNER_CATEGORIES, type BrandPartner, type BrandPartnerCategory, type Reveal } from "@/lib/types";
import { revealBrandCode } from "./actions";

type CategoryFilter = BrandPartnerCategory | "all";

interface Props {
  brands: BrandPartner[];
  revealsByBrand: Record<string, Reveal>;
  profileComplete: boolean;
  remaining: number;
  resetLabel: string;
}

export function VaultGrid({
  brands,
  revealsByBrand: initialReveals,
  profileComplete,
  remaining: initialRemaining,
  resetLabel,
}: Props) {
  // Both pieces of state move together when a NEW reveal happens. Re-views
  // don't change either — they just re-open the modal with the same code.
  const [revealsByBrand, setRevealsByBrand] = useState(initialReveals);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [openBrand, setOpenBrand] = useState<{ brand: BrandPartner; code: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const { notify } = useToast();

  // Only show category pills for categories that actually have brands.
  const availableCategories = useMemo(() => {
    const present = new Set(brands.map((b) => b.category));
    return BRAND_PARTNER_CATEGORIES.filter((c) => present.has(c.value));
  }, [brands]);

  const filteredBrands = useMemo(() => {
    if (category === "all") return brands;
    return brands.filter((b) => b.category === category);
  }, [brands, category]);

  async function handleReveal(brand: BrandPartner) {
    const existing = revealsByBrand[brand.id];

    // Re-view path: we already have the row server-side, but we need the actual
    // discount_code which only the RPC returns. Cheap call, no cap impact.
    if (existing || !profileComplete || remaining <= 0) {
      // Disabled CTAs shouldn't reach here, but guard anyway.
      if (!existing && (!profileComplete || remaining <= 0)) return;
    }

    setPendingId(brand.id);
    const result = await revealBrandCode(brand.id);
    setPendingId(null);

    if (!result.ok) {
      notify(result.message, "error");
      return;
    }

    // Sync local state from authoritative server response
    setRemaining(Math.max(0, result.reveals_cap - result.reveals_used_this_month));
    if (result.status === "new") {
      setRevealsByBrand((prev) => ({
        ...prev,
        [brand.id]: {
          // We don't have the full Reveal row from the action — id/timestamp
          // aren't needed for UI, just presence in the map.
          id: "",
          athlete_id: "",
          brand_partner_id: brand.id,
          revealed_at: new Date().toISOString(),
        },
      }));
    }
    setOpenBrand({ brand, code: result.discount_code });
  }

  function close() {
    setOpenBrand(null);
  }

  return (
    <>
      {availableCategories.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <CategoryPill
            value="all"
            current={category}
            onChange={setCategory}
            label={`All (${brands.length})`}
          />
          {availableCategories.map((c) => {
            const count = brands.filter((b) => b.category === c.value).length;
            return (
              <CategoryPill
                key={c.value}
                value={c.value}
                current={category}
                onChange={setCategory}
                label={`${c.label} (${count})`}
              />
            );
          })}
        </div>
      )}

      {filteredBrands.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
          <p className="text-sm text-zinc-500">Nothing in this category yet.</p>
        </div>
      ) : (
      <div className={`${availableCategories.length > 1 ? "mt-4" : "mt-6"} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}>
        {filteredBrands.map((brand) => {
          const revealed = !!revealsByBrand[brand.id];
          const capReached = !revealed && remaining <= 0;
          const disabledReason = !profileComplete
            ? "profile"
            : capReached
            ? "cap"
            : null;

          return (
            <BrandCard
              key={brand.id}
              brand={brand}
              revealed={revealed}
              loading={pendingId === brand.id}
              disabledReason={disabledReason}
              resetLabel={resetLabel}
              onReveal={() => handleReveal(brand)}
            />
          );
        })}
      </div>

      )}

      {openBrand && <RevealModal brand={openBrand.brand} code={openBrand.code} onClose={close} />}
    </>
  );
}

function CategoryPill({
  value,
  current,
  onChange,
  label,
}: {
  value: CategoryFilter;
  current: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
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

function BrandCard({
  brand,
  revealed,
  loading,
  disabledReason,
  resetLabel,
  onReveal,
}: {
  brand: BrandPartner;
  revealed: boolean;
  loading: boolean;
  disabledReason: "profile" | "cap" | null;
  resetLabel: string;
  onReveal: () => void;
}) {
  const disabled = !revealed && disabledReason !== null;

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          {brand.logo_url ? (
            <Image
              src={brand.logo_url}
              alt={brand.name}
              width={48}
              height={48}
              className="h-12 w-12 object-cover"
            />
          ) : (
            <span className="text-base font-bold text-zinc-400">
              {brand.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight text-acl-black dark:text-zinc-100 truncate">
            {brand.name}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{brand.offer_headline}</p>
        </div>
      </div>

      {brand.offer_description && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3">
          {brand.offer_description}
        </p>
      )}

      <div className="mt-4 flex-1" />

      {revealed ? (
        <button
          type="button"
          onClick={onReveal}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-acl-orange/40 bg-acl-orange/10 px-3 py-2 text-sm font-medium text-acl-orange hover:bg-acl-orange/15 disabled:opacity-50"
        >
          {loading ? "Loading..." : (<><Check className="h-3.5 w-3.5" /> View code</>)}
        </button>
      ) : disabled ? (
        <DisabledReveal reason={disabledReason!} resetLabel={resetLabel} />
      ) : (
        <button
          type="button"
          onClick={onReveal}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
        >
          {loading ? "Revealing..." : "Reveal code"}
        </button>
      )}
    </div>
  );
}

function DisabledReveal({
  reason,
  resetLabel,
}: {
  reason: "profile" | "cap";
  resetLabel: string;
}) {
  if (reason === "profile") {
    return (
      <Link
        href="/settings"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <Lock className="h-3.5 w-3.5" />
        Complete your profile
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-zinc-500">
      <p className="font-medium text-zinc-600 dark:text-zinc-300">Reveals used up</p>
      <p className="mt-0.5">Resets {resetLabel}.</p>
    </div>
  );
}

function RevealModal({
  brand,
  code,
  onClose,
}: {
  brand: BrandPartner;
  code: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / restrictive contexts: fall back silently.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-zinc-400">
                  {brand.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 truncate">
                {brand.name}
              </p>
              <p className="text-xs text-zinc-500 line-clamp-2">{brand.offer_headline}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-no-min-tap
            className="shrink-0 -m-1 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
          Your code
        </p>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-acl-orange/50 bg-acl-orange/5 px-4 py-3">
          <code className="flex-1 min-w-0 truncate font-mono text-lg sm:text-xl font-bold tracking-wider text-acl-black dark:text-zinc-100">
            {code}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-acl-orange/40 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-acl-orange hover:bg-acl-orange/10"
          >
            {copied ? (<><Check className="h-3.5 w-3.5" /> Copied</>) : (<><Copy className="h-3.5 w-3.5" /> Copy</>)}
          </button>
        </div>

        <a
          href={brand.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-acl-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-acl-orange/90"
        >
          Shop now
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <p className="mt-2 text-[11px] text-zinc-400 text-center">
          Re-opening this card later doesn&apos;t use another reveal.
        </p>
      </div>
    </div>
  );
}
