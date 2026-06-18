"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { FileText, Paperclip, Plus, Send, X, Zap } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useCredits } from "@/components/credits-provider";
import { LogOutreachButton } from "@/components/log-outreach-button";
import { celebrateWin, type WinKind } from "@/components/win-celebration";
import { createClient } from "@/lib/supabase/client";

// Inline-sentinel emitted by /api/coach when a tool call results in a
// "win" — see winFromToolUse on the server. Stripped from display text
// and used to dispatch the celebration modal.
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
      // Malformed sentinel — drop silently rather than leak markers to display.
    }
    return "";
  });
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
  image_paths: string[];
}

interface Props {
  initialMessages: Message[];
  initialThreadId: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_PDF_TYPE = "application/pdf";
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ALLOWED_PDF_TYPE];

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export function CoachChat({ initialMessages, initialThreadId }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const { credits, decrement } = useCredits();
  const noCredits = credits <= 0;
  const { notify } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sign storage paths for any image refs we haven't resolved yet. Signed
  // URLs are 1 hour — long enough for an active session, short enough that
  // a leaked URL stops working soon after the tab closes.
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
    return () => {
      cancelled = true;
    };
  }, [messages, signedUrls]);

  // Local preview URL is a blob: handle — must be revoked when replaced.
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      created_at: new Date().toISOString(),
      image_paths: imagePaths,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Keep the local blob URL as the "signed" URL for this path so the
    // optimistic message renders the image immediately. The real signed
    // URL will replace it on next mount, but for this session it's fine.
    if (uploadedPath && localPreviewUrl) {
      setSignedUrls((prev) => ({ ...prev, [uploadedPath]: localPreviewUrl }));
    }
    setPendingImage(null);
    if (fileRef.current) fileRef.current.value = "";

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, image_paths: imagePaths, thread_id: threadId }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: data?.error || "Something went wrong. Try again.",
            created_at: new Date().toISOString(),
            image_paths: [],
          },
        ]);
      } else {
        const id = `resp-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id,
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            image_paths: [],
          },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        let firstChunk = true;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          // Strip complete win sentinels (fires celebrations as a side effect)
          // and hide any partial sentinel still being streamed from display.
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
          created_at: new Date().toISOString(),
          image_paths: [],
        },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function startNewChat() {
    if (loading) return;
    setThreadId(crypto.randomUUID());
    setMessages([]);
    setPendingImage(null);
    setInput("");
    if (fileRef.current) fileRef.current.value = "";
    inputRef.current?.focus();
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-acl-black dark:text-zinc-100">AI Assistant</h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Your NIL and business assistant</p>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          disabled={loading || messages.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          title="Start a fresh conversation (model won't see past messages)"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-lg font-medium text-acl-black dark:text-zinc-100">
              Hey, I&apos;m your AI Assistant.
            </p>
            <p className="text-sm text-zinc-400 mt-1 max-w-xs">
              Ask me about NIL, brand outreach, your pipeline, or anything else.
              Snap a photo of a contract, business card, or DM and I&apos;ll log
              it for you.
            </p>
          </div>
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
                    className="mb-1 inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <FileText className="h-4 w-4 text-acl-orange" />
                    <span className="truncate max-w-[220px]">{filename}</span>
                  </a>
                );
              }
              return (
                <div
                  key={path}
                  className="mb-1 max-w-[70%] overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt="Attached"
                      className="block max-h-64 w-auto"
                    />
                  ) : (
                    <div className="h-32 w-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  )}
                </div>
              );
            })}
            {msg.content && (
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
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
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2">
          <div className="relative inline-block">
            {pendingImage.file.type === ALLOWED_PDF_TYPE ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-acl-orange" />
                <span className="truncate max-w-[220px]">{pendingImage.file.name}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingImage.previewUrl}
                alt="Pending"
                className="h-20 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
            )}
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-0.5 shadow"
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
      >
        {noCredits && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10 px-3 py-2 text-xs">
            <p className="text-red-700 dark:text-red-300">
              <Zap className="inline h-3 w-3 -mt-0.5" fill="currentColor" /> You&apos;re out of credits.
            </p>
            <Link
              href="/settings#credits"
              className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
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
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 p-2.5 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
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
            placeholder={noCredits ? "Top up credits to keep chatting" : "Ask your AI Assistant..."}
            disabled={noCredits}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue disabled:bg-zinc-50 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || noCredits || (!input.trim() && !pendingImage)}
            className="rounded-lg bg-acl-orange p-2.5 text-white hover:bg-acl-orange/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </>
  );
}
