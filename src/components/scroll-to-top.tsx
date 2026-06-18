"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Resets scroll to the top whenever the route changes.
 *
 * Mobile native apps always open a tab at the top, never preserving the
 * previous screen's scroll. The browser tries to restore scroll on back/forward
 * which feels wrong inside a tabbed layout, so we force scroll-to-top on every
 * pathname change. We use `instant` to bypass the `scroll-behavior: smooth` on
 * <html> so tab switches feel snappy instead of slowly scrolling.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
