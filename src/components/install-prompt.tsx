"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const STORAGE_KEY = "aclplus-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isIOSStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return isIOS && isSafari;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (isIOSStandalone()) return;
    if (!isIOSSafari()) return; // only prompt on iOS Safari for now
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS) return;
    }
    // Slight delay so the banner doesn't flash before page content settles.
    const t = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-[calc(var(--mobile-nav-h)+0.75rem)] inset-x-4 z-50 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-3 md:hidden"
      role="dialog"
      aria-label="Install ACL+"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-acl-orange/10 text-acl-orange">
          <Share className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-acl-black dark:text-zinc-100">
            Install ACL+ on your phone
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            Tap <span className="font-semibold">Share</span> <Share className="inline h-3 w-3 mx-0.5" /> in Safari, then
            <span className="font-semibold"> Add to Home Screen</span>. Launches full-screen, no browser chrome.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          data-no-min-tap
          className="shrink-0 -m-1 p-1 text-zinc-400 hover:text-acl-black dark:hover:text-zinc-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
