"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { celebrateWin } from "@/components/win-celebration";
import { CONTENT_PLATFORMS } from "@/lib/types";
import type { ContentPost, ContentStatus } from "@/lib/types";

interface Props {
  posts: ContentPost[];
  statuses: { value: ContentStatus; label: string }[];
}

const STATUS_CARD_TONE: Record<ContentStatus, string> = {
  idea: "bg-zinc-100/70",
  drafted: "bg-blue-50/70",
  scheduled: "bg-amber-50/70",
  posted: "bg-green-50/70",
};

const STATUS_CHIP: Record<ContentStatus, string> = {
  idea: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700",
  drafted: "bg-blue-50 text-blue-700",
  scheduled: "bg-amber-50 text-amber-700",
  posted: "bg-green-50 text-green-700",
};

function formatPlanned(date: string | null): string {
  if (!date) return "";
  const today = new Date().toISOString().split("T")[0];
  if (date === today) return "Today";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function platformLabel(p: string): string {
  return CONTENT_PLATFORMS.find((x) => x.value === p)?.label ?? p;
}

function cardTitle(post: ContentPost): string {
  return post.title || (post.caption ? post.caption.slice(0, 80) : "Untitled");
}

export function ContentPipelineClient({ posts: initialPosts, statuses }: Props) {
  const supabase = createClient();
  const { notify } = useToast();
  const [posts, setPosts] = useState(initialPosts);

  function postsForStatus(status: ContentStatus) {
    return posts.filter((p) => p.status === status);
  }

  async function persistStatusChange(id: string, oldStatus: ContentStatus, newStatus: ContentStatus) {
    const updates: { status: ContentStatus; posted_at?: string } = { status: newStatus };
    const wasPosted = oldStatus === "posted";
    const willBePosted = newStatus === "posted";
    if (!wasPosted && willBePosted) {
      updates.posted_at = new Date().toISOString();
    }

    const previous = posts;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: newStatus,
              posted_at: updates.posted_at ?? p.posted_at,
            }
          : p,
      ),
    );

    const { error } = await supabase.from("content_posts").update(updates).eq("id", id);
    if (error) {
      setPosts(previous);
      notify("Couldn't update status. Try again.", "error");
      return;
    }

    if (!wasPosted && willBePosted) {
      const post = previous.find((p) => p.id === id);
      celebrateWin({
        kind: "content_posted",
        subject: post ? cardTitle(post) : "",
        postedUrl: post?.posted_url ?? undefined,
      });
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as ContentStatus;
    const post = posts.find((p) => p.id === draggableId);
    if (!post || post.status === newStatus) return;
    await persistStatusChange(draggableId, post.status, newStatus);
  }

  async function handleMobileChange(id: string, newStatus: ContentStatus) {
    const post = posts.find((p) => p.id === id);
    if (!post || post.status === newStatus) return;
    await persistStatusChange(id, post.status, newStatus);
  }

  const noPosts = posts.length === 0;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Content Pipeline</h1>
          <Link href="/content" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
            List view
          </Link>
          <Link href="/content/calendar" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
            Calendar
          </Link>
        </div>
        <Link
          href="/content/new"
          className="flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
        >
          <Plus className="h-4 w-4" />
          New Post
        </Link>
      </div>

      {noPosts && (
        <div className="hidden md:block rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No content posts yet.</p>
          <Link
            href="/content/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
          >
            <Plus className="h-4 w-4" />
            New Post
          </Link>
        </div>
      )}

      {/* Desktop kanban */}
      <div className={noPosts ? "hidden" : "hidden md:block"}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {statuses.map((status) => {
              const columnPosts = postsForStatus(status.value);
              return (
                <Droppable key={status.value} droppableId={status.value}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`w-64 shrink-0 rounded-lg p-2 ${
                        snapshot.isDraggingOver ? "bg-acl-orange/10" : STATUS_CARD_TONE[status.value]
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                          {status.label}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{columnPosts.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[60px]">
                        {columnPosts.map((post, index) => (
                          <Draggable key={post.id} draggableId={post.id} index={index}>
                            {(provided, snapshot) => (
                              <Link
                                href={`/content/${post.id}`}
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`block rounded-lg border bg-white dark:bg-zinc-900 p-3 text-sm transition-shadow ${
                                  snapshot.isDragging
                                    ? "shadow-lg border-acl-orange"
                                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                }`}
                              >
                                <p className="font-medium text-acl-black dark:text-zinc-100 line-clamp-2">
                                  {cardTitle(post)}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] text-zinc-500">
                                    {platformLabel(post.platform)}
                                  </span>
                                  {post.planned_for && (
                                    <span className="text-[11px] text-zinc-500">
                                      · {formatPlanned(post.planned_for)}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Mobile grouped scroll */}
      <div className="md:hidden space-y-6">
        {statuses.map((status) => {
          const columnPosts = postsForStatus(status.value);
          if (columnPosts.length === 0) return null;
          return (
            <div key={status.value}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[status.value]}`}>
                  {status.label}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{columnPosts.length}</span>
              </div>
              <div className="space-y-2">
                {columnPosts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3"
                  >
                    <Link href={`/content/${post.id}`} className="block">
                      <p className="text-sm font-medium text-acl-black dark:text-zinc-100 line-clamp-2">
                        {cardTitle(post)}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {platformLabel(post.platform)}
                        {post.planned_for && ` · ${formatPlanned(post.planned_for)}`}
                      </p>
                    </Link>
                    <select
                      value={post.status}
                      onChange={(e) => handleMobileChange(post.id, e.target.value as ContentStatus)}
                      className="mt-2 w-full rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-zinc-600"
                    >
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {noPosts && (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">No content posts yet.</p>
            <Link
              href="/content/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
            >
              <Plus className="h-4 w-4" />
              New Post
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
