"use client";

import { useEffect, useState } from "react";
import { ExternalLink, PartyPopper, X } from "lucide-react";
import { SKOOL_COMMUNITY_URL } from "@/lib/links";

// Wins that warrant a "share with the community" prompt. Kept narrow on
// purpose — every action shouldn't pop a modal. Add new kinds here only
// when the moment is genuinely worth the interruption.
export type WinKind =
  | "deal_closed"
  | "content_posted"
  | "contract_signed"
  | "contract_completed"
  | "payment_received";

interface WinPayload {
  kind: WinKind;
  // A human-readable subject line — brand name for deals, post title or
  // a short caption snippet for content.
  subject: string;
  // Optional URL to the live post / brand site for the share copy.
  postedUrl?: string;
}

const WIN_EVENT = "acl:win";

// Fire-and-forget helper for client code. Server actions can't dispatch
// DOM events, so call this immediately after the awaited action returns
// success at the call site.
export function celebrateWin(payload: WinPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WIN_EVENT, { detail: payload }));
}

function copyFor(kind: WinKind, subject: string, postedUrl?: string): {
  emoji: string;
  title: string;
  body: string;
  ctaLabel: string;
} {
  switch (kind) {
    case "deal_closed":
      return {
        emoji: "🤝",
        title: "Deal closed",
        body: `${subject} is in the books. The community would love to hear how you closed it.`,
        ctaLabel: "Share on Skool",
      };
    case "content_posted":
      return {
        emoji: "🎬",
        title: "Post is live",
        body: postedUrl
          ? `Your ${subject ? `"${subject}" ` : ""}post is up. Drop the link in Skool so the rest of the lab can show it some love.`
          : `Your post is up${subject ? ` — ${subject}` : ""}. Share it in Skool so the rest of the lab can show it some love.`,
        ctaLabel: "Share on Skool",
      };
    case "contract_signed":
      return {
        emoji: "✍️",
        title: "Contract signed",
        body: `${subject ? `${subject} ` : "The contract "}is signed. Share the news in Skool — Insiders need to see what closing actually looks like.`,
        ctaLabel: "Share on Skool",
      };
    case "contract_completed":
      return {
        emoji: "✅",
        title: "Contract completed",
        body: `${subject ? `${subject} ` : "The contract "}is done — deliverables shipped, terms fulfilled. Worth a Skool post.`,
        ctaLabel: "Share on Skool",
      };
    case "payment_received":
      return {
        emoji: "💸",
        title: "Payment received",
        body: `${subject ? `${subject} just hit. ` : "Payment in. "}Share the receipt energy with the lab.`,
        ctaLabel: "Share on Skool",
      };
  }
}

export function WinCelebrationProvider() {
  const [win, setWin] = useState<WinPayload | null>(null);

  useEffect(() => {
    function onWin(e: Event) {
      const detail = (e as CustomEvent<WinPayload>).detail;
      if (!detail || !detail.kind) return;
      setWin(detail);
    }
    window.addEventListener(WIN_EVENT, onWin as EventListener);
    return () => window.removeEventListener(WIN_EVENT, onWin as EventListener);
  }, []);

  useEffect(() => {
    if (!win) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setWin(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [win]);

  if (!win) return null;

  const copy = copyFor(win.kind, win.subject, win.postedUrl);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:p-4 sm:items-center"
      onClick={() => setWin(null)}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setWin(null)}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>{copy.emoji}</span>
          <PartyPopper className="h-5 w-5 text-acl-orange" />
        </div>
        <h2 className="mt-2 text-lg font-bold tracking-tight text-acl-black dark:text-zinc-100">
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{copy.body}</p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <a
            href={SKOOL_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setWin(null)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-acl-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-acl-orange/90"
          >
            {copy.ctaLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setWin(null)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
