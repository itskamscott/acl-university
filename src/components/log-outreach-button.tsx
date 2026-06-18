"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

interface BrandOption {
  id: string;
  business_name: string;
}

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "dm", label: "DM" },
  { value: "call", label: "Call" },
  { value: "in_person", label: "In Person" },
  { value: "other", label: "Other" },
];

export function LogOutreachButton({ messageContent }: { messageContent: string }) {
  const [open, setOpen] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [channel, setChannel] = useState("email");
  const [content, setContent] = useState(messageContent);
  const [followupDate, setFollowupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();

  async function handleOpen() {
    setOpen(true);
    setContent(messageContent);
    setError("");
    if (athleteId && brands.length > 0) return;

    setLoadingBrands(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're signed out. Refresh and try again.");
      setLoadingBrands(false);
      return;
    }
    const { data: athlete } = await supabase
      .from("athletes")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (!athlete) {
      setError("Athlete profile not found.");
      setLoadingBrands(false);
      return;
    }
    setAthleteId(athlete.id);

    const { data: brandRows } = await supabase
      .from("brands")
      .select("id, business_name")
      .eq("athlete_id", athlete.id)
      .order("updated_at", { ascending: false });

    setBrands((brandRows ?? []) as BrandOption[]);
    if (brandRows && brandRows.length > 0) {
      setBrandId(brandRows[0].id as string);
    }
    setLoadingBrands(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteId || !brandId) {
      setError("Pick a brand.");
      return;
    }
    if (content.trim().length < 3) {
      setError("Add a little detail.");
      return;
    }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("brand_activities").insert({
      brand_id: brandId,
      athlete_id: athleteId,
      activity_type: "outreach",
      channel,
      content: content.trim(),
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    if (followupDate) {
      await supabase
        .from("brands")
        .update({ next_followup_date: followupDate })
        .eq("id", brandId);
    }

    const brand = brands.find((b) => b.id === brandId);
    notify(`Outreach logged${brand ? ` for ${brand.business_name}` : ""}.`, "success");
    setOpen(false);
    setSaving(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-[11px] font-medium text-acl-blue hover:underline"
      >
        Log as outreach
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:p-4 sm:items-center"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-2xl max-h-[90dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-acl-black dark:text-zinc-100">Log as outreach</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingBrands ? (
              <p className="mt-4 text-sm text-zinc-500">Loading brands…</p>
            ) : brands.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                You don&apos;t have any brands yet. Add one first, then come back.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">Brand</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.business_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                    What you said / plan to say
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                    Follow-up date (optional)
                  </label>
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
                  >
                    {saving ? "Logging..." : "Log outreach"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
