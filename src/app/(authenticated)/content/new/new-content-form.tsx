"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { findOrCreateBrand } from "@/lib/brands/resolver";
import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
} from "@/lib/types";
import type {
  Brand,
  ContentPlatform,
  ContentStatus,
} from "@/lib/types";

interface Props {
  athleteId: string;
  brands: Pick<Brand, "id" | "business_name">[];
}

export function NewContentForm({ athleteId, brands }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const platform = form.get("platform") as ContentPlatform;
    const status = form.get("status") as ContentStatus;
    const caption = ((form.get("caption") as string) || "").trim() || null;
    const title = ((form.get("title") as string) || "").trim() || null;
    const plannedFor = (form.get("planned_for") as string) || null;
    const notes = ((form.get("notes") as string) || "").trim() || null;
    const brandName = ((form.get("brand_name") as string) || "").trim();

    if (!caption && !title) {
      notify("Add a title or a caption — something to remember this post by.", "error");
      setSaving(false);
      return;
    }

    let brandId: string | null = null;
    if (brandName) {
      const res = await findOrCreateBrand(supabase, athleteId, brandName, {
        statusOnCreate: "in_conversation",
      });
      if (!res.ok) {
        notify(res.error, "error");
        setSaving(false);
        return;
      }
      brandId = res.brand.id;
      if (res.brand.created) {
        notify(`Added "${res.brand.business_name}" to your brands.`, "info");
      }
    }

    const { data, error } = await supabase
      .from("content_posts")
      .insert({
        athlete_id: athleteId,
        brand_id: brandId,
        title,
        platform,
        status,
        caption,
        planned_for: plannedFor,
        notes,
      })
      .select("id")
      .single();

    if (error || !data) {
      notify(error?.message ?? "Couldn't save post.", "error");
      setSaving(false);
      return;
    }

    notify("Post saved.", "success");
    router.push(`/content/${data.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Platform</label>
          <select name="platform" defaultValue="instagram" className={inputClass}>
            {CONTENT_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Status</label>
          <select name="status" defaultValue="idea" className={inputClass}>
            {CONTENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Title (optional)</label>
        <input
          name="title"
          placeholder="Internal note, e.g. Spring Gameday carousel"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Caption</label>
        <textarea
          name="caption"
          rows={6}
          placeholder="Draft the actual caption you'll post..."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Planned for</label>
          <input name="planned_for" type="date" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Brand (optional)</label>
          <input
            name="brand_name"
            list="content-brand-options"
            placeholder="Paid partnership? Name the brand"
            className={inputClass}
          />
          <datalist id="content-brand-options">
            {brands.map((b) => (
              <option key={b.id} value={b.business_name} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Shot list, references, anything else to remember..."
          className={inputClass}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save post"}
        </button>
        <Link
          href="/content"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
