"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-zinc-950 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Something went wrong</h1>
      <p className="mt-2 max-w-xs text-sm text-zinc-500">
        We hit an unexpected error. Try again, or head back to your dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
