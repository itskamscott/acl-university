"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { celebrateWin } from "@/components/win-celebration";
import { findOrCreateBrand } from "@/lib/brands/resolver";
import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
} from "@/lib/types";
import type {
  Brand,
  ContentPlatform,
  ContentPost,
  ContentStatus,
} from "@/lib/types";

interface Props {
  post: ContentPost & { brands: { id: string; business_name: string } | null };
  brands: Pick<Brand, "id" | "business_name">[];
  athleteId: string;
}

function statusClass(status: ContentStatus): string {
  if (status === "idea") return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
  if (status === "drafted") return "bg-blue-50 text-blue-700";
  if (status === "scheduled") return "bg-amber-50 text-amber-700";
  return "bg-green-50 text-green-700";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContentDetailClient({ post: initialPost, brands, athleteId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { notify } = useToast();
  const [post, setPost] = useState(initialPost);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingPosted, setMarkingPosted] = useState(false);

  const statusLabel = CONTENT_STATUSES.find((s) => s.value === post.status)?.label ?? post.status;
  const platformLabel = CONTENT_PLATFORMS.find((p) => p.value === post.platform)?.label ?? post.platform;

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const brandName = ((form.get("brand_name") as string) || "").trim();

    let brandId: string | null = null;
    if (brandName) {
      const res = await findOrCreateBrand(supabase, athleteId, brandName, {
        statusOnCreate: "in_conversation",
      });
      if (!res.ok) {
        notify(res.error, "error");
        setSaving(false);
        return;
      }
      brandId = res.brand.id;
      if (res.brand.created) notify(`Added "${res.brand.business_name}" to your brands.`, "info");
    }

    const updates = {
      title: ((form.get("title") as string) || "").trim() || null,
      platform: form.get("platform") as ContentPlatform,
      status: form.get("status") as ContentStatus,
      caption: ((form.get("caption") as string) || "").trim() || null,
      planned_for: (form.get("planned_for") as string) || null,
      posted_url: ((form.get("posted_url") as string) || "").trim() || null,
      notes: ((form.get("notes") as string) || "").trim() || null,
      brand_id: brandId,
    };

    const { data, error } = await supabase
      .from("content_posts")
      .update(updates)
      .eq("id", post.id)
      .select("*, brands(id, business_name)")
      .single();

    if (error || !data) {
      notify(error?.message ?? "Couldn't save.", "error");
      setSaving(false);
      return;
    }
    setPost(data as typeof post);
    setEditing(false);
    setSaving(false);
    notify("Post updated.", "success");
  }

  async function handleMarkPosted() {
    setMarkingPosted(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("content_posts")
      .update({ status: "posted", posted_at: nowIso })
      .eq("id", post.id)
      .select("*, brands(id, business_name)")
      .single();
    if (error || !data) {
      notify(error?.message ?? "Couldn't update.", "error");
      setMarkingPosted(false);
      return;
    }
    setPost(data as typeof post);
    setMarkingPosted(false);
    notify("Marked as posted.", "success");
    celebrateWin({
      kind: "content_posted",
      subject: post.title || (post.caption ? post.caption.slice(0, 60) : ""),
      postedUrl: post.posted_url ?? undefined,
    });
  }

  async function handleDelete() {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("content_posts").delete().eq("id", post.id);
    if (error) {
      notify(error.message, "error");
      setDeleting(false);
      return;
    }
    notify("Post deleted.", "success");
    router.push("/content");
    router.refresh();
  }

  async function copyCaption() {
    if (!post.caption) return;
    try {
      await navigator.clipboard.writeText(post.caption);
      notify("Caption copied.", "success");
    } catch {
      notify("Couldn't copy.", "error");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link
        href="/content"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Content
      </Link>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Platform</label>
              <select name="platform" defaultValue={post.platform} className={inputClass}>
                {CONTENT_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Status</label>
              <select name="status" defaultValue={post.status} className={inputClass}>
                {CONTENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Title</label>
            <input name="title" defaultValue={post.title ?? ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Caption</label>
            <textarea
              name="caption"
              rows={8}
              defaultValue={post.caption ?? ""}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Planned for</label>
              <input
                name="planned_for"
                type="date"
                defaultValue={post.planned_for ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Brand</label>
              <input
                name="brand_name"
                list="detail-brand-options"
                defaultValue={post.brands?.business_name ?? ""}
                placeholder="Paid partnership? Name the brand"
                className={inputClass}
              />
              <datalist id="detail-brand-options">
                {brands.map((b) => (
                  <option key={b.id} value={b.business_name} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Posted URL</label>
            <input
              name="posted_url"
              type="url"
              defaultValue={post.posted_url ?? ""}
              placeholder="https://instagram.com/p/..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={post.notes ?? ""}
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="ml-auto text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
                {post.title || (post.caption ? post.caption.slice(0, 60) : "Untitled")}
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {platformLabel}
                {post.brands && (
                  <>
                    <span className="mx-1.5 text-zinc-300">·</span>
                    <Link href={`/brands/${post.brands.id}`} className="hover:text-acl-black dark:hover:text-zinc-100">
                      {post.brands.business_name}
                    </Link>
                  </>
                )}
                {post.planned_for && (
                  <>
                    <span className="mx-1.5 text-zinc-300">·</span>
                    Planned for {formatDate(post.planned_for)}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(post.status)}`}>
                {statusLabel}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Edit
              </button>
            </div>
          </div>

          {post.status !== "posted" && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleMarkPosted}
                disabled={markingPosted}
                className="inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {markingPosted ? "Marking..." : "Mark as posted"}
              </button>
            </div>
          )}

          {post.caption ? (
            <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Caption</p>
                <button
                  type="button"
                  onClick={copyCaption}
                  className="inline-flex items-center gap-1 text-xs text-acl-blue hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <p className="text-sm text-acl-black dark:text-zinc-100 whitespace-pre-wrap">{post.caption}</p>
            </div>
          ) : (
            <div className="mb-6 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-sm text-zinc-400 text-center">
              No caption written yet. Click Edit to draft one, or ask the AI Assistant.
            </div>
          )}

          {post.posted_url && (
            <div className="mb-6">
              <p className="text-xs text-zinc-400 mb-1">Posted URL</p>
              <a
                href={post.posted_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-acl-blue hover:underline break-all"
              >
                {post.posted_url}
              </a>
              {post.posted_at && (
                <p className="text-xs text-zinc-400 mt-1">Posted {formatDate(post.posted_at)}</p>
              )}
            </div>
          )}

          {post.notes && (
            <div className="mb-6">
              <p className="text-xs text-zinc-400 mb-1">Notes</p>
              <p className="text-sm text-acl-black dark:text-zinc-100 whitespace-pre-wrap">{post.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
