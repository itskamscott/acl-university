"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { celebrateWin } from "@/components/win-celebration";
import type { Brand, BrandActivity, BrandCategory, BrandStatus } from "@/lib/types";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { AddActivity } from "./add-activity";

interface ContractRef {
  id: string;
  title: string;
  status: string;
  total_value_cents: number | null;
  currency: string;
  signed_at: string | null;
}

interface Props {
  brand: Brand;
  activities: BrandActivity[];
  contracts: ContractRef[];
  athleteId: string;
  categories: { value: BrandCategory; label: string }[];
  statuses: { value: BrandStatus; label: string }[];
}

export function BrandDetailClient({ brand: initialBrand, activities: initialActivities, contracts, athleteId, categories, statuses }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { notify } = useToast();
  const [brand, setBrand] = useState(initialBrand);
  const [activities, setActivities] = useState(initialActivities);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const isArchived = brand.archived_at !== null;

  async function handleArchiveToggle() {
    setArchiving(true);
    const nextValue = isArchived ? null : new Date().toISOString();
    const { data, error: archiveError } = await supabase
      .from("brands")
      .update({ archived_at: nextValue })
      .eq("id", brand.id)
      .select()
      .single();

    if (archiveError || !data) {
      notify(archiveError?.message ?? "Couldn't update.", "error");
      setArchiving(false);
      return;
    }

    setBrand(data as Brand);
    notify(
      isArchived ? `${brand.business_name} restored.` : `${brand.business_name} archived.`,
      "success",
    );
    setArchiving(false);
    if (!isArchived) {
      // After archiving, bounce back to the list.
      router.push("/brands");
      router.refresh();
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${brand.business_name} permanently? This removes the brand and all its activity and can't be undone. Archive instead if you just want to hide it.`,
    );
    if (!confirmed) return;
    setDeleting(true);

    const { error: deleteError } = await supabase
      .from("brands")
      .delete()
      .eq("id", brand.id);

    if (deleteError) {
      notify(deleteError.message, "error");
      setDeleting(false);
      return;
    }

    notify(`${brand.business_name} deleted.`, "success");
    router.push("/brands");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const newStatus = form.get("status") as BrandStatus;
    const statusChanged = newStatus !== brand.status;

    const updates = {
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
      status: newStatus,
      next_followup_date: (form.get("next_followup_date") as string) || null,
    };

    const { data, error: updateError } = await supabase
      .from("brands")
      .update(updates)
      .eq("id", brand.id)
      .select()
      .single();

    if (updateError) {
      notify(updateError.message, "error");
      setSaving(false);
      return;
    }

    if (statusChanged) {
      const oldLabel = statuses.find(s => s.value === brand.status)?.label || brand.status;
      const newLabel = statuses.find(s => s.value === newStatus)?.label || newStatus;

      if (newStatus === "deal_closed" && brand.status !== "deal_closed") {
        celebrateWin({ kind: "deal_closed", subject: brand.business_name });
      }

      await supabase.from("brand_activities").insert({
        brand_id: brand.id,
        athlete_id: athleteId,
        activity_type: "status_change",
        content: `Status changed from ${oldLabel} to ${newLabel}`,
      });

      // Refresh activities
      const { data: newActivities } = await supabase
        .from("brand_activities")
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });

      setActivities((newActivities || []) as BrandActivity[]);
    }

    setBrand(data as Brand);
    setEditing(false);
    setSaving(false);
    notify("Changes saved.", "success");
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const statusLabel = statuses.find(s => s.value === brand.status)?.label || brand.status;
  const categoryLabel = categories.find(c => c.value === brand.category)?.label || brand.category;

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href={isArchived ? "/brands?archived=1" : "/brands"}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {isArchived ? "Back to Archived" : "Back to Brands"}
      </Link>

      {isArchived && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This brand is archived. Click Edit → Unarchive to restore it to your pipeline.
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Business Name</label>
            <input name="business_name" defaultValue={brand.business_name} required className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Category</label>
              <select name="category" defaultValue={brand.category} className={inputClass}>
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Status</label>
              <select name="status" defaultValue={brand.status} className={inputClass}>
                {statuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">City</label>
              <input name="city" defaultValue={brand.city || ""} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">State</label>
              <input name="state" defaultValue={brand.state || ""} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Website</label>
            <input name="website" type="url" defaultValue={brand.website || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Instagram</label>
            <input name="instagram_handle" defaultValue={brand.instagram_handle || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Contact Name</label>
            <input name="contact_name" defaultValue={brand.contact_name || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Contact Email</label>
            <input name="contact_email" type="email" defaultValue={brand.contact_email || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Contact Phone</label>
            <input name="contact_phone" type="tel" defaultValue={brand.contact_phone || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Next Follow-up</label>
            <input name="next_followup_date" type="date" defaultValue={brand.next_followup_date || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Notes</label>
            <textarea name="notes" rows={3} defaultValue={brand.notes || ""} className={inputClass} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || deleting || archiving}
              className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <div className="ml-auto flex items-center gap-4">
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={saving || deleting || archiving}
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-acl-black dark:hover:text-zinc-100 disabled:opacity-50"
              >
                {archiving
                  ? isArchived
                    ? "Restoring..."
                    : "Archiving..."
                  : isArchived
                  ? "Unarchive"
                  : "Archive"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting || archiving}
                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">{brand.business_name}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {categoryLabel} {brand.city || brand.state ? `· ${[brand.city, brand.state].filter(Boolean).join(", ")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                {statusLabel}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-8">
            {brand.website && (
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Website</p>
                <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-acl-blue hover:underline">
                  {brand.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {brand.instagram_handle && (
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Instagram</p>
                <p className="text-acl-black dark:text-zinc-100">{brand.instagram_handle}</p>
              </div>
            )}
            {brand.contact_name && (
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Contact</p>
                <p className="text-acl-black dark:text-zinc-100">{brand.contact_name}</p>
              </div>
            )}
            {brand.contact_email && (
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Email</p>
                <p className="text-acl-black dark:text-zinc-100">{brand.contact_email}</p>
              </div>
            )}
            {brand.contact_phone && (
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Phone</p>
                <p className="text-acl-black dark:text-zinc-100">{brand.contact_phone}</p>
              </div>
            )}
            {brand.next_followup_date && (
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Next Follow-up</p>
                <p className="text-acl-black dark:text-zinc-100">{formatDate(brand.next_followup_date)}</p>
              </div>
            )}
          </div>

          {brand.notes && (
            <div className="mb-8">
              <p className="text-xs text-zinc-400 mb-1">Notes</p>
              <p className="text-sm text-acl-black dark:text-zinc-100 whitespace-pre-wrap">{brand.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-zinc-400 mb-1">Added {formatDate(brand.created_at)}</p>
          </div>
        </>
      )}

      {/* Contracts */}
      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
            Contracts {contracts.length > 0 && `(${contracts.length})`}
          </h2>
          <Link
            href={`/contracts/new?brand=${brand.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-acl-blue hover:underline"
          >
            <Plus className="h-3 w-3" />
            New contract
          </Link>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No contracts linked yet. Upload one or let the AI Assistant draft.
          </p>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => {
              const statusTone =
                c.status === "active"
                  ? "bg-blue-50 text-blue-700"
                  : c.status === "completed"
                  ? "bg-green-50 text-green-700"
                  : c.status === "cancelled"
                  ? "bg-red-50 text-red-700"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
              const value =
                c.total_value_cents !== null
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: c.currency.toUpperCase(),
                      maximumFractionDigits: c.total_value_cents % 100 === 0 ? 0 : 2,
                    }).format(c.total_value_cents / 100)
                  : null;
              return (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">{c.title}</p>
                      {(value || c.signed_at) && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {value}
                          {value && c.signed_at && <span className="mx-1.5 text-zinc-300">·</span>}
                          {c.signed_at && `Signed ${c.signed_at}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 ml-3 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusTone}`}>
                    {c.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-4">Activity</h2>
        <div className="mb-4">
          <AddActivity
            brandId={brand.id}
            athleteId={athleteId}
            onAdded={(activity) => setActivities((prev) => [activity, ...prev])}
            onFollowupUpdated={(date) =>
              setBrand((b) => ({ ...b, next_followup_date: date }))
            }
          />
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
                    {activity.activity_type === "status_change" ? "Status" : activity.activity_type === "outreach" ? "Outreach" : "Note"}
                  </span>
                  {activity.channel && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{activity.channel}</span>
                  )}
                  <span className="text-xs text-zinc-400 ml-auto">{formatTime(activity.created_at)}</span>
                </div>
                <p className="text-sm text-acl-black dark:text-zinc-100">{activity.content}</p>
                {activity.response_received !== null && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Response: {activity.response_received ? "Yes" : "No"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
