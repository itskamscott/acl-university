"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CircleAlert, X } from "lucide-react";

interface Props {
  missing: string[];
}

const DISMISS_KEY = "acl:profile-banner-dismissed-at";
// Re-show the banner if it's been dismissed for more than this — the
// goal is a friendly nudge, not a permanent silence.
const REDISMISS_AFTER_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function ProfileCompletionBanner({ missing }: Props) {
  const pathname = usePathname();
  const [dismissedRecently, setDismissedRecently] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      setDismissedRecently(false);
      return;
    }
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > REDISMISS_AFTER_MS) {
      setDismissedRecently(false);
      return;
    }
    setDismissedRecently(true);
  }, []);

  // No banner on Settings (that's where they fix it) or signup-adjacent flows.
  if (pathname?.startsWith("/settings")) return null;
  if (missing.length === 0) return null;
  if (dismissedRecently) return null;

  const missingLabel =
    missing.length === 1
      ? missing[0]
      : missing.length === 2
      ? `${missing[0]} and ${missing[1]}`
      : `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`;

  return (
    <div className="border-b border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <CircleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 min-w-0 text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Finish your profile</span>
          <span className="hidden sm:inline"> — still need {missingLabel}. </span>
          <span className="sm:hidden"> — {missing.length} field{missing.length === 1 ? "" : "s"} missing. </span>
          <span className="text-amber-800/80 dark:text-amber-300/80">
            Brand Vault unlocks once everything's in.
          </span>
        </p>
        <Link
          href="/settings"
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Finish
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setDismissedRecently(true);
          }}
          className="shrink-0 rounded-lg p-1 text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
