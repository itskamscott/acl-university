"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { BRAND_CATEGORIES } from "@/lib/types";
import type { BrandCategory } from "@/lib/types";

export default function AddBrandPage() {
  const router = useRouter();
  const supabase = createClient();
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    // Get current athlete
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: athlete } = await supabase
      .from("athletes")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!athlete) {
      setError("Athlete profile not found");
      setLoading(false);
      return;
    }

    const { data: newBrand, error: insertError } = await supabase
      .from("brands")
      .insert({
        athlete_id: athlete.id,
        business_name: form.get("business_name") as string,
        category: form.get("category") as BrandCategory,
        city: (form.get("city") as string) || null,
        state: (form.get("state") as string) || null,
        website: (form.get("website") as string) || null,
        instagram_handle: (form.get("instagram_handle") as string) || null,
        contact_name: (form.get("contact_name") as string) || null,
        contact_email: (form.get("contact_email") as string) || null,
        contact_phone: (form.get("contact_phone") as string) || null,
        notes: (form.get("notes") as string) || null,
      })
      .select("id")
      .single();

    if (insertError || !newBrand) {
      setError(insertError?.message || "Couldn't save. Try again.");
      setLoading(false);
      return;
    }

    notify("Brand added.", "success");
    router.push(`/brands/${newBrand.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  return (
    <div className="p-4 md:p-6 max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-6">Add Brand</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Business Name *
          </label>
          <input
            name="business_name"
            required
            className={inputClass}
            placeholder="e.g. Joe's Coffee"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Category *
          </label>
          <select name="category" required className={inputClass}>
            <option value="">Select a category</option>
            {BRAND_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              City
            </label>
            <input name="city" className={inputClass} placeholder="City" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              State
            </label>
            <input name="state" className={inputClass} placeholder="State" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Website
          </label>
          <input name="website" type="url" className={inputClass} placeholder="https://..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Instagram Handle
          </label>
          <input name="instagram_handle" className={inputClass} placeholder="@handle" />
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Contact Name
          </label>
          <input name="contact_name" className={inputClass} placeholder="Primary contact" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Contact Email
          </label>
          <input name="contact_email" type="email" className={inputClass} placeholder="contact@brand.com" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Contact Phone
          </label>
          <input name="contact_phone" type="tel" className={inputClass} placeholder="(555) 123-4567" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            rows={3}
            className={inputClass}
            placeholder="Anything to remember about this brand..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Brand"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
