"use client";

import { useState } from "react";

interface Idea {
  platform: string;
  headline: string;
  body: string;
}
interface ResultRow {
  athlete_id: string;
  athlete_name: string;
  ideas: Idea[];
}

export function ContentIdeasSection({ teamId }: { teamId: string }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/content-ideas`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Idea generation failed.");
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
          Team content ideas
        </h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-acl-orange/90 disabled:opacity-50"
        >
          {loading ? "Generating…" : results ? "Regenerate" : "Generate ideas"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {results === null && !error && !loading && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500">
          Click <span className="font-semibold">Generate ideas</span> to ask the
          ACL coach for content concepts tailored to each athlete on this team.
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-500">
          Thinking through ideas for each athlete…
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="space-y-3">
          {results.map((row) => (
            <div
              key={row.athlete_id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
            >
              <p className="text-sm font-semibold text-acl-black dark:text-zinc-100">
                {row.athlete_name}
              </p>
              <ul className="mt-2 space-y-2">
                {row.ideas.map((idea, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-acl-black dark:text-zinc-100">
                        {idea.headline}
                      </p>
                      <span className="shrink-0 rounded-full bg-acl-blue/10 px-2 py-0.5 text-[10px] font-medium text-acl-blue uppercase">
                        {idea.platform}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {idea.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500">
          No athletes on this team yet — add some, then try again.
        </div>
      )}
    </section>
  );
}
