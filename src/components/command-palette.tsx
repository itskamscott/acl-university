"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  FileText,
  Clapperboard,
  MessageCircle,
  LayoutDashboard,
  Plus,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CommandKind = "action" | "brand" | "contract" | "content";

interface Command {
  id: string;
  label: string;
  subtitle?: string;
  kind: CommandKind;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

const SEARCH_DEBOUNCE_MS = 150;

export function CommandPalette() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamicResults, setDynamicResults] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDynamicResults([]);
    setSelectedIndex(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const openCoach = useCallback(() => {
    close();
    router.push("/coach");
  }, [close, router]);

  const staticCommands = useMemo<Command[]>(
    () => [
      {
        id: "coach",
        label: "Open AI Assistant",
        subtitle: "Chat with your NIL assistant",
        kind: "action",
        icon: MessageCircle,
        run: openCoach,
      },
      {
        id: "new-brand",
        label: "New brand",
        kind: "action",
        icon: Plus,
        run: () => go("/brands/new"),
      },
      {
        id: "new-contract",
        label: "New contract",
        kind: "action",
        icon: Plus,
        run: () => go("/contracts/new"),
      },
      {
        id: "new-content",
        label: "New content post",
        kind: "action",
        icon: Plus,
        run: () => go("/content/new"),
      },
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        kind: "action",
        icon: LayoutDashboard,
        run: () => go("/dashboard"),
      },
      {
        id: "nav-brands",
        label: "Go to Brands",
        kind: "action",
        icon: Building2,
        run: () => go("/brands"),
      },
      {
        id: "nav-contracts",
        label: "Go to Contracts",
        kind: "action",
        icon: FileText,
        run: () => go("/contracts"),
      },
      {
        id: "nav-content",
        label: "Go to Content",
        kind: "action",
        icon: Clapperboard,
        run: () => go("/content"),
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        kind: "action",
        icon: Settings,
        run: () => go("/settings"),
      },
    ],
    [go, openCoach],
  );

  // Cmd/Ctrl+K binding
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced search across brands/contracts/content
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const handle = setTimeout(async () => {
      if (q.length < 2) {
        setDynamicResults([]);
        return;
      }
      const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
      const [brandsRes, contractsRes, contentRes] = await Promise.all([
        supabase
          .from("brands")
          .select("id, business_name, status")
          .is("archived_at", null)
          .ilike("business_name", pattern)
          .limit(5),
        supabase
          .from("contracts")
          .select("id, title, status")
          .ilike("title", pattern)
          .limit(5),
        supabase
          .from("content_posts")
          .select("id, title, caption, platform")
          .or(`title.ilike.${pattern},caption.ilike.${pattern}`)
          .limit(5),
      ]);

      const results: Command[] = [];
      for (const b of brandsRes.data ?? []) {
        results.push({
          id: `brand-${b.id}`,
          label: b.business_name as string,
          subtitle: `Brand · ${String(b.status).replace(/_/g, " ")}`,
          kind: "brand",
          icon: Building2,
          run: () => go(`/brands/${b.id}`),
        });
      }
      for (const c of contractsRes.data ?? []) {
        results.push({
          id: `contract-${c.id}`,
          label: c.title as string,
          subtitle: `Contract · ${c.status}`,
          kind: "contract",
          icon: FileText,
          run: () => go(`/contracts/${c.id}`),
        });
      }
      for (const p of contentRes.data ?? []) {
        const label = (p.title as string | null) || (p.caption ? String(p.caption).slice(0, 60) : "Untitled");
        results.push({
          id: `content-${p.id}`,
          label,
          subtitle: `Content · ${p.platform}`,
          kind: "content",
          icon: Clapperboard,
          run: () => go(`/content/${p.id}`),
        });
      }
      setDynamicResults(results);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, open, supabase, go]);

  // Filter static commands by query
  const filteredStatic = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staticCommands;
    return staticCommands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, staticCommands]);

  const allResults = useMemo(
    () => [...filteredStatic, ...dynamicResults],
    [filteredStatic, dynamicResults],
  );

  // Reset selection when results change — pattern from React docs for
  // derived-from-props state resets without a cascading render.
  const [lastResultsKey, setLastResultsKey] = useState("");
  const resultsKey = `${query}|${dynamicResults.length}`;
  if (resultsKey !== lastResultsKey) {
    setLastResultsKey(resultsKey);
    setSelectedIndex(0);
  }

  // Arrow keys + Enter
  useEffect(() => {
    if (!open) return;
    function onNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = allResults[selectedIndex];
        if (cmd) cmd.run();
      }
    }
    window.addEventListener("keydown", onNav);
    return () => window.removeEventListener("keydown", onNav);
  }, [open, allResults, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[10vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands, contracts, content or jump anywhere…"
            className="flex-1 bg-transparent text-sm text-acl-black dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />
          <span className="shrink-0 rounded border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            esc
          </span>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {allResults.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-400 text-center">No matches.</p>
          ) : (
            allResults.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  data-index={idx}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => cmd.run()}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                    isSelected ? "bg-zinc-100 dark:bg-zinc-800" : "bg-white"
                  }`}
                >
                  <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">{cmd.label}</p>
                    {cmd.subtitle && (
                      <p className="text-xs text-zinc-400 truncate">{cmd.subtitle}</p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="shrink-0 rounded border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                      ↵
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
