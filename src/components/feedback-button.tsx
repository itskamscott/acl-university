"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { FEEDBACK_TYPES } from "@/lib/types";
import type { FeedbackType } from "@/lib/types";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      notify("Tell us a little more.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        notify(data?.error ?? "Couldn't send feedback.", "error");
        setSaving(false);
        return;
      }
      notify("Thanks — we got it.", "success");
      setMessage("");
      setType("bug");
      setOpen(false);
    } catch {
      notify("Couldn't send feedback.", "error");
    }
    setSaving(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
      >
        <span className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5" />
          Send feedback
        </span>
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
              <h2 className="text-base font-bold text-acl-black dark:text-zinc-100">Send feedback</h2>
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
            <p className="mb-4 text-xs text-zinc-500">
              Spotted a bug, have an idea, or something else to share? It comes
              straight to the team.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">Type</label>
                <div className="flex gap-2">
                  {FEEDBACK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        type === t.value ? "bg-acl-orange text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  {type === "bug"
                    ? "What happened?"
                    : type === "feature"
                    ? "What do you want to see?"
                    : "What's on your mind?"}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  required
                  autoFocus
                  placeholder={
                    type === "bug"
                      ? "Clicked Save and got a red banner..."
                      : type === "feature"
                      ? "Would love to filter pipeline by..."
                      : "Tell us..."
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || message.trim().length < 5}
                  className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
                >
                  {saving ? "Sending..." : "Send"}
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
          </div>
        </div>
      )}
    </>
  );
}
