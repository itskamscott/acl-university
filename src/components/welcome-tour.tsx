"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Clapperboard,
  FileText,
  Gift,
  MessageCircle,
  X,
} from "lucide-react";

interface Slide {
  icon: typeof Building2;
  title: string;
  body: string;
  href: string;
  hrefLabel: string;
}

const SLIDES: Slide[] = [
  {
    icon: Building2,
    title: "Brand CRM",
    body: "Every local business you want to work with goes here. Move them through a pipeline — Prospect → Contacted → Negotiating → Closed — so you always know who needs follow-up.",
    href: "/brands",
    hrefLabel: "Open Brand CRM",
  },
  {
    icon: MessageCircle,
    title: "AI Assistant",
    body: "Your personal NIL assistant. Snap a photo of a business card, contract, or DM and it'll log everything for you. Ask it to draft outreach. Ask it to find brands you haven't followed up with.",
    href: "/coach",
    hrefLabel: "Open AI Assistant",
  },
  {
    icon: FileText,
    title: "Contracts",
    body: "Upload a contract PDF and the assistant pulls out deliverables and payment terms automatically. Track what you owe the brand and what they owe you.",
    href: "/contracts",
    hrefLabel: "Open Contracts",
  },
  {
    icon: Clapperboard,
    title: "Content calendar",
    body: "Capture ideas, draft captions, schedule posts. Mark each one as posted so you can see your output over time and tie posts back to specific brand deals.",
    href: "/content",
    hrefLabel: "Open Content",
  },
  {
    icon: Gift,
    title: "Brand Vault",
    body: "Free discount codes from ACL brand partners. You get 3 reveals each month. Complete your profile (sport, school, Instagram, shipping) to unlock the vault.",
    href: "/vault",
    hrefLabel: "Open Brand Vault",
  },
];

const SEEN_KEY = "acl:welcome-tour-seen";
const OPEN_EVENT = "acl:open-welcome-tour";

// Fire-and-forget helper: any client component can call this to re-open
// the tour (e.g. a "Tour the app" button on the dashboard).
export function openWelcomeTour(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Props {
  // The athlete's account-creation timestamp. We only auto-show the tour
  // for accounts created in the last 24h, so existing users don't get
  // surprised by it after this rolls out.
  athleteCreatedAt: string;
  // First name for the greeting; trimmed to one word.
  firstName: string;
}

export function WelcomeTour({ athleteCreatedAt, firstName }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = !!window.localStorage.getItem(SEEN_KEY);
    if (!seen) {
      const createdAt = new Date(athleteCreatedAt).getTime();
      const isFresh = Date.now() - createdAt < 1000 * 60 * 60 * 24;
      if (isFresh) {
        const t = setTimeout(() => setOpen(true), 300);
        return () => clearTimeout(t);
      }
    }
  }, [athleteCreatedAt]);

  // Manual re-open via openWelcomeTour() — used by "Tour the app" links.
  useEffect(() => {
    function onOpen() {
      setIndex(0);
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismiss() {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    setOpen(false);
  }

  if (!open) return null;

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const Icon = slide.icon;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 sm:p-4 sm:items-center"
      onClick={dismiss}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-0 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close tour"
          className="absolute top-3 right-3 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100 z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 pb-3">
          {index === 0 && (
            <p className="text-[11px] uppercase tracking-wider font-semibold text-acl-orange">
              Welcome, {firstName}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-acl-orange/10">
              <Icon className="h-5 w-5 text-acl-orange" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-acl-black dark:text-zinc-100">
              {slide.title}
            </h2>
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {slide.body}
          </p>
        </div>

        <div className="px-5 pb-2 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-acl-orange" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-800/30">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-medium text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Back
              </button>
            )}
            {isLast ? (
              <Link
                href={slide.href}
                onClick={dismiss}
                className="rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-acl-orange/90"
              >
                {slide.hrefLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setIndex(index + 1)}
                className="rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-acl-orange/90"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
