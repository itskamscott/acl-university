"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import type { BrandActivity } from "@/lib/types";

interface Props {
  brandId: string;
  athleteId: string;
  onAdded: (activity: BrandActivity) => void;
  onFollowupUpdated?: (date: string) => void;
}

export function AddActivity({ brandId, athleteId, onAdded, onFollowupUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"outreach" | "note">("outreach");
  const [channel, setChannel] = useState("email");
  const [content, setContent] = useState("");
  const [responseReceived, setResponseReceived] = useState<string>("pending");
  const [followupDate, setFollowupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { notify } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);

    const { data, error: insertError } = await supabase
      .from("brand_activities")
      .insert({
        brand_id: brandId,
        athlete_id: athleteId,
        activity_type: type,
        channel: type === "outreach" ? channel : null,
        content: content.trim(),
        response_received: type === "outreach" ? (responseReceived === "yes" ? true : responseReceived === "no" ? false : null) : null,
      })
      .select()
      .single();

    if (insertError) {
      notify("Couldn't save activity. Try again.", "error");
      setSaving(false);
      return;
    }

    // Update follow-up date if provided
    if (followupDate) {
      await supabase
        .from("brands")
        .update({ next_followup_date: followupDate })
        .eq("id", brandId);
      onFollowupUpdated?.(followupDate);
    }

    onAdded(data as BrandActivity);
    notify(type === "outreach" ? "Outreach logged." : "Note added.", "success");
    setContent("");
    setFollowupDate("");
    setResponseReceived("pending");
    setOpen(false);
    setSaving(false);
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  if (!open) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => { setType("outreach"); setOpen(true); }}
          className="rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-acl-orange/90"
        >
          Log Outreach
        </button>
        <button
          onClick={() => { setType("note"); setOpen(true); }}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Add Note
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setType("outreach")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            type === "outreach" ? "bg-acl-orange text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
          }`}
        >
          Outreach
        </button>
        <button
          type="button"
          onClick={() => setType("note")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            type === "note" ? "bg-acl-orange text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
          }`}
        >
          Note
        </button>
      </div>

      {type === "outreach" && (
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            <option value="email">Email</option>
            <option value="dm">DM</option>
            <option value="call">Call</option>
            <option value="in_person">In Person</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
          {type === "outreach" ? "What did you say/do?" : "Note"}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          required
          className={inputClass}
          placeholder={type === "outreach" ? "Sent a DM introducing myself..." : "Remember to mention..."}
        />
      </div>

      {type === "outreach" && (
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">Response?</label>
          <select value={responseReceived} onChange={(e) => setResponseReceived(e.target.value)} className={inputClass}>
            <option value="pending">Pending</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">Next follow-up date</label>
        <input
          type="date"
          value={followupDate}
          onChange={(e) => setFollowupDate(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
