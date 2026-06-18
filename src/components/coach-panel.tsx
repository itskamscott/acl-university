"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FileText, MessageCircle, Paperclip, Plus, X, Send, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/components/credits-provider";
import { useToast } from "@/components/toast-provider";
import { LogOutreachButton } from "@/components/log-outreach-button";
import { celebrateWin, type WinKind } from "@/components/win-celebration";

// Stream sentinel format — see api/coach/route.ts winFromToolUse.
const WIN_SENTINEL_RE = /\x00WIN:([^\x00]*)\x00/g;
const WIN_PARTIAL_RE = /\x00WIN:[^\x00]*$/;

function processWinSentinels(text: string): string {
  return text.replace(WIN_SENTINEL_RE, (_, json) => {
    try {
      const parsed = JSON.parse(json) as { kind?: WinKind; subject?: string; postedUrl?: string };
      if (parsed.kind) {
        celebrateWin({
          kind: parsed.kind,
          subject: parsed.subject ?? "",
          postedUrl: parsed.postedUrl,
        });
      }
    } catch {
      // Malformed sentinel — drop.
    }
    return "";
  });
}

interface Message {
  id: string;
  role: string;
  content: string;
  image_paths: string[];
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_PDF_TYPE = "application/pdf";
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ALLOWED_PDF_TYPE];

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export function CoachPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [threadId, setThreadId] = useState<string | null>(null);
  const { credits, decrement } = useCredits();
  const noCredits = credits <= 0;
  const { notify } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hide the floating shortcut on the dedicated AI Assistant page itself.
  // Computed up-front so we can short-circuit AFTER all hooks below have
  // been declared — early-returning before the hooks would change the hook
  // call order between routes and crash with a Rules-of-Hooks violation.
  const hideOnCoach = pathname.startsWith("/coach");

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || historyLoaded) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: athlete } = await supabase
        .from("athletes")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (!athlete || cancelled) return;

      // Find the latest thread, then load its tail.
      const { data: latest } = await supabase
        .from("coach_messages")
        .select("thread_id")
        .eq("athlete_id", athlete.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const tid = (latest?.thread_id as string | undefined) ?? crypto.randomUUID();
      if (cancelled) return;
      setThreadId(tid);

      if (latest?.thread_id) {
        const { data } = await supabase
          .from("coach_messages")
          .select("id, role, content, image_paths")
          .eq("athlete_id", athlete.id)
          .eq("thread_id", tid)
          .order("created_at", { ascending: false })
          .limit(10);
        if (cancelled) return;
        if (data && data.length > 0) {
          setMessages(
            data
              .reverse()
              .map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                image_paths: (m.image_paths ?? []) as string[],
              })),
          );
        }
      }
      setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, historyLoaded]);

  // Sign storage paths on demand (panel-local, isolated from full-page chat).
  useEffect(() => {
    const allPaths = new Set<string>();
    for (const m of messages) for (const p of m.image_paths) allPaths.add(p);
    const missing = Array.from(allPaths).filter((p) => !(p in signedUrls));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const updates: Record<string, string> = {};
      for (const path of missing) {
        const { data } = await supabase.storage
          .from("assistant-uploads")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) updates[path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [messages, signedUrls]);

  useEffect(() => {
    if (!pendingImage) return;
    return () => URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  function handleFilePick(file: File | null) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      notify("Attachment must be an image (JPEG/PNG/GIF/WebP) or PDF.", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      notify("Attachment must be under 10MB.", "error");
      return;
    }
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function uploadPendingImage(): Promise<string | null> {
    if (!pendingImage) return null;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      notify("Sign in and try again.", "error");
      return null;
    }
    const { data: athlete } = await supabase
      .from("athletes")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (!athlete) {
      notify("Couldn't find your athlete profile.", "error");
      return null;
    }
    const isPdf = pendingImage.file.type === ALLOWED_PDF_TYPE;
    const ext = (pendingImage.file.name.split(".").pop() || (isPdf ? "pdf" : "jpg")).toLowerCase();
    const path = `${athlete.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("assistant-uploads")
      .upload(path, pendingImage.file, { contentType: pendingImage.file.type });
    if (error) {
      notify(`Image upload failed: ${error.message}`, "error");
      return null;
    }
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    setLoading(true);
    setInput("");

    let uploadedPath: string | null = null;
    if (pendingImage) {
      uploadedPath = await uploadPendingImage();
      if (!uploadedPath) {
        setLoading(false);
        return;
      }
    }

    const localPreviewUrl = pendingImage?.previewUrl;
    const imagePaths = uploadedPath ? [uploadedPath] : [];

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      image_paths: imagePaths,
    };
    setMessages((prev) => [...prev, userMsg]);

    if (uploadedPath && localPreviewUrl) {
      setSignedUrls((prev) => ({ ...prev, [uploadedPath]: localPreviewUrl }));
    }
    setPendingImage(null);
    if (fileRef.current) fileRef.current.value = "";

    try {
      const tid = threadId ?? crypto.randomUUID();
      if (!threadId) setThreadId(tid);

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          image_paths: imagePaths,
          thread_id: tid,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: data?.error || "Something went wrong. Try again.",
            image_paths: [],
          },
        ]);
      } else {
        const id = `resp-${Date.now()}`;
        setMessages((prev) => [...prev, { id, role: "assistant", content: "", image_paths: [] }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        let firstChunk = true;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          assistantText = processWinSentinels(assistantText);
          const displayText = assistantText.replace(WIN_PARTIAL_RE, "");
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: displayText } : m)),
          );
          if (firstChunk) {
            setLoading(false);
            decrement();
            firstChunk = false;
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Something went wrong. Try again.",
          image_paths: [],
        },
      ]);
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Safe to early-return now: all hooks above have already run, so the call
  // order is stable across routes.
  if (hideOnCoach) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 md:right-6 bottom-[calc(var(--mobile-nav-h)+0.75rem)] md:bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-acl-orange text-white shadow-lg hover:bg-acl-orange/90 transition-transform hover:scale-105"
        aria-label="Open AI Assistant"
        title="Open AI Assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 md:right-6 bottom-[calc(var(--mobile-nav-h)+0.75rem)] md:bottom-6 z-50 flex flex-col w-[calc(100vw-2rem)] max-w-sm h-[28rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">AI Assistant</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Ask me anything</p>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (loading) return;
              setThreadId(crypto.randomUUID());
              setMessages([]);
              setPendingImage(null);
              setInput("");
              if (fileRef.current) fileRef.current.value = "";
            }}
            disabled={loading || messages.length === 0}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100 disabled:opacity-40"
            title="New chat"
            aria-label="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-400 text-center mt-8">
            Ask about NIL, outreach, your pipeline, or attach a photo (contract, business card, DM).
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {msg.image_paths.map((path) => {
              const url = signedUrls[path];
              const filename = path.split("/").pop() ?? "attachment";
              if (isPdfPath(path)) {
                return (
                  <a
                    key={path}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-1 inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-acl-orange" />
                    <span className="truncate max-w-[160px]">{filename}</span>
                  </a>
                );
              }
              return (
                <div
                  key={path}
                  className="mb-1 max-w-[80%] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="Attached" className="block max-h-40 w-auto" />
                  ) : (
                    <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  )}
                </div>
              );
            })}
            {msg.content && (
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-acl-black dark:bg-acl-orange text-white rounded-br-md"
                    : "bg-zinc-100 dark:bg-zinc-800 text-acl-black dark:text-zinc-100 rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            )}
            {msg.role === "assistant" && msg.content.trim().length > 0 && (
              <div className="mt-1 ml-1">
                <LogOutreachButton messageContent={msg.content} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-md px-3 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2">
          <div className="relative inline-block">
            {pendingImage.file.type === ALLOWED_PDF_TYPE ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 text-acl-orange" />
                <span className="truncate max-w-[160px]">{pendingImage.file.name}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingImage.previewUrl}
                alt="Pending"
                className="h-14 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
            )}
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-0.5 shadow"
              aria-label="Remove attachment"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2">
        {noCredits && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10 px-2.5 py-1.5 text-[11px]">
            <p className="text-red-700 dark:text-red-300">
              <Zap className="inline h-3 w-3 -mt-0.5" fill="currentColor" /> Out of credits
            </p>
            <Link
              href="/settings#credits"
              onClick={() => setOpen(false)}
              className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700"
            >
              Top up
            </Link>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading || !!pendingImage || noCredits}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            aria-label="Attach image or PDF"
            title={noCredits ? "Top up to attach a file" : "Attach image or PDF"}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noCredits ? "Top up to keep chatting" : "Ask your AI Assistant..."}
            disabled={noCredits}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue disabled:bg-zinc-50 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || noCredits || (!input.trim() && !pendingImage)}
            className="rounded-lg bg-acl-orange p-2 text-white hover:bg-acl-orange/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
