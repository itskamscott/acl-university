"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

interface Props {
  // Plain-language explanation of what this section/feature is for.
  // Two short sentences max — long copy belongs in the welcome tour, not here.
  text: string;
  // Optional override of the button label for screen readers.
  label?: string;
  className?: string;
}

export function HelpTooltip({ text, label = "Help", className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-acl-orange/30"
        aria-label={label}
        aria-expanded={open}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-6 z-50 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-3 text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed"
        >
          {text}
        </div>
      )}
    </div>
  );
}
