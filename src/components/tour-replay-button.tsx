"use client";

import { Compass } from "lucide-react";
import { openWelcomeTour } from "@/components/welcome-tour";

export function TourReplayButton() {
  return (
    <button
      type="button"
      onClick={() => openWelcomeTour()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      <Compass className="h-3.5 w-3.5" />
      Tour the app
    </button>
  );
}
