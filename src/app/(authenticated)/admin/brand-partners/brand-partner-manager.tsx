"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ExternalLink, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { BRAND_PARTNER_CATEGORIES, type BrandPartner } from "@/lib/types";
import {
  createBrandPartner,
  deleteBrandPartner,
  sendBrandDropEmail,
  toggleBrandPartnerActive,
  updateBrandPartner,
  type BrandPartnerInput,
} from "./actions";

interface Props {
  brands: BrandPartner[];
  revealCounts: Record<string, number>;
  dropEmailCounts: Record<string, number>;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

const emptyForm: BrandPartnerInput = {
  name: "",
  logo_url: null,
  website_url: "https://",
  offer_headline: "",
  offer_description: null,
  discount_code: "",
  category: "other",
  is_active: true,
  display_order: 0,
};

export function BrandPartnerManager({ brands, revealCounts, dropEmailCounts }: Props) {
  // null = closed, "new" = creating, brand id = editing that row
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();

  const editingBrand = brands.find((b) => b.id === editing);
  const initial: BrandPartnerInput =
    editing === "new"
      ? { ...emptyForm, display_order: nextOrder(brands) }
      : editingBrand
      ? brandToInput(editingBrand)
      : emptyForm;

  function close() {
    if (isPending) return;
    setEditing(null);
  }

  function handleSubmit(values: BrandPartnerInput) {
    startTransition(async () => {
      const result =
        editing === "new"
          ? await createBrandPartner(values)
          : editing
          ? await updateBrandPartner(editing, values)
          : { ok: false as const, error: "Nothing selected" };

      if (!result.ok) {
        notify(result.error, "error");
        return;
      }
      notify(editing === "new" ? "Brand added." : "Brand updated.", "success");
      setEditing(null);
    });
  }

  function handleToggle(brand: BrandPartner) {
    startTransition(async () => {
      const result = await toggleBrandPartnerActive(brand.id, !brand.is_active);
      if (!result.ok) notify(result.error, "error");
      else notify(brand.is_active ? "Hidden from athletes." : "Live for athletes.", "success");
    });
  }

  function handleSendDrop(brand: BrandPartner) {
    const alreadySent = dropEmailCounts[brand.id] ?? 0;
    const confirmed = window.confirm(
      alreadySent > 0
        ? `Send drop email for ${brand.name}? Athletes who already received it (${alreadySent}) will be skipped automatically.`
        : `Send drop email for ${brand.name} to every opted-in athlete?`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await sendBrandDropEmail(brand.id);
      if (!result.ok) {
        notify(result.error, "error");
        return;
      }
      const parts = [`${result.sent} sent`];
      if (result.alreadySent > 0) parts.push(`${result.alreadySent} already had it`);
      if (result.optedOut > 0) parts.push(`${result.optedOut} opted out`);
      notify(parts.join(" · "), result.sent > 0 ? "success" : "error");
    });
  }

  function handleDelete(brand: BrandPartner) {
    const reveals = revealCounts[brand.id] ?? 0;
    const confirmed = window.confirm(
      reveals > 0
        ? `Delete ${brand.name}? This will also delete ${reveals} reveal${reveals === 1 ? "" : "s"} (cascade). Consider toggling Active off instead to preserve attribution.`
        : `Delete ${brand.name}? This can't be undone.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteBrandPartner(brand.id);
      if (!result.ok) notify(result.error, "error");
      else notify("Brand deleted.", "success");
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-500">
          {brands.length} total · {brands.filter((b) => b.is_active).length} active
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
        >
          <Plus className="h-4 w-4" />
          New brand
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
          <p className="text-sm text-zinc-500">No brand partners yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {brands.map((brand) => (
            <BrandRow
              key={brand.id}
              brand={brand}
              reveals={revealCounts[brand.id] ?? 0}
              dropEmailsSent={dropEmailCounts[brand.id] ?? 0}
              disabled={isPending}
              onEdit={() => setEditing(brand.id)}
              onToggle={() => handleToggle(brand)}
              onSendDrop={() => handleSendDrop(brand)}
              onDelete={() => handleDelete(brand)}
            />
          ))}
        </div>
      )}

      {editing && (
        <BrandPartnerForm
          mode={editing === "new" ? "new" : "edit"}
          initial={initial}
          saving={isPending}
          onCancel={close}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}

function categoryLabel(value: BrandPartner["category"]): string {
  return BRAND_PARTNER_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function nextOrder(brands: BrandPartner[]): number {
  const max = brands.reduce((acc, b) => Math.max(acc, b.display_order), 0);
  // Pad by 10 so the next admin can drop a brand between two without renumbering.
  return max + 10;
}

function brandToInput(b: BrandPartner): BrandPartnerInput {
  return {
    name: b.name,
    logo_url: b.logo_url,
    website_url: b.website_url,
    offer_headline: b.offer_headline,
    offer_description: b.offer_description,
    discount_code: b.discount_code,
    category: b.category,
    is_active: b.is_active,
    display_order: b.display_order,
  };
}

function BrandRow({
  brand,
  reveals,
  dropEmailsSent,
  disabled,
  onEdit,
  onToggle,
  onSendDrop,
  onDelete,
}: {
  brand: BrandPartner;
  reveals: number;
  dropEmailsSent: number;
  disabled: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onSendDrop: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
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

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold tracking-tight text-acl-black dark:text-zinc-100 truncate">
            {brand.name}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              brand.is_active
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
            }`}
          >
            {brand.is_active ? "Active" : "Hidden"}
          </span>
          <span className="text-[11px] text-zinc-400">
            {categoryLabel(brand.category)} · order {brand.display_order} · {reveals} reveal{reveals === 1 ? "" : "s"}
            {dropEmailsSent > 0 && ` · ${dropEmailsSent} emailed`}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{brand.offer_headline}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
          <a
            href={brand.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-acl-blue truncate max-w-[180px]"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{brand.website_url.replace(/^https?:\/\//, "")}</span>
          </a>
          <span>
            Code: <code className="font-mono text-zinc-500">{brand.discount_code}</code>
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1">
        {brand.is_active && (
          <button
            type="button"
            onClick={onSendDrop}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-acl-blue/40 bg-acl-blue/5 px-2 py-1 text-[11px] font-medium text-acl-blue hover:bg-acl-blue/10 disabled:opacity-50"
            title="Email opted-in athletes about this brand"
          >
            <Mail className="h-3 w-3" />
            {dropEmailsSent > 0 ? "Email more" : "Email drop"}
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          {brand.is_active ? "Hide" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100 disabled:opacity-50"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 disabled:opacity-50"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BrandPartnerForm({
  mode,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  mode: "new" | "edit";
  initial: BrandPartnerInput;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: BrandPartnerInput) => void;
}) {
  const [values, setValues] = useState<BrandPartnerInput>(initial);

  function update<K extends keyof BrandPartnerInput>(key: K, value: BrandPartnerInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-2xl max-h-[90dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-acl-black dark:text-zinc-100">
            {mode === "new" ? "New brand partner" : "Edit brand partner"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            data-no-min-tap
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Brand name
            </label>
            <input
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Logo URL
            </label>
            <input
              value={values.logo_url ?? ""}
              onChange={(e) => update("logo_url", e.target.value || null)}
              placeholder="https://… (optional)"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Square images render best (40–48px). Leave blank for a letter fallback.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Website URL
            </label>
            <input
              value={values.website_url}
              onChange={(e) => update("website_url", e.target.value)}
              placeholder="https://…"
              required
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-zinc-400">Where the &quot;Shop now&quot; button sends athletes.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Offer headline
            </label>
            <input
              value={values.offer_headline}
              onChange={(e) => update("offer_headline", e.target.value)}
              placeholder="15% off your first order"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Offer description
            </label>
            <textarea
              value={values.offer_description ?? ""}
              onChange={(e) => update("offer_description", e.target.value || null)}
              rows={2}
              placeholder="Terms, exclusions, anything athletes should know."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Discount code
            </label>
            <input
              value={values.discount_code}
              onChange={(e) => update("discount_code", e.target.value)}
              placeholder="ACL15"
              required
              className={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Category
            </label>
            <select
              value={values.category}
              onChange={(e) => update("category", e.target.value as BrandPartnerInput["category"])}
              className={inputClass}
            >
              {BRAND_PARTNER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                Display order
              </label>
              <input
                type="number"
                value={values.display_order}
                onChange={(e) => update("display_order", Number(e.target.value) || 0)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-zinc-400">Lower sorts first.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                Status
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.is_active}
                  onChange={(e) => update("is_active", e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-acl-orange"
                />
                <span className="text-acl-black dark:text-zinc-100">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : mode === "new" ? "Add brand" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
