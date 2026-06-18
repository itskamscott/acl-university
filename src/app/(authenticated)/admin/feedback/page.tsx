import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEEDBACK_TYPES } from "@/lib/types";
import type { Feedback, FeedbackType } from "@/lib/types";

export const metadata = { title: "Admin — Feedback" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelFor(type: FeedbackType): string {
  return FEEDBACK_TYPES.find((t) => t.value === type)?.label ?? type;
}

function chipClass(type: FeedbackType): string {
  if (type === "bug") return "bg-red-50 text-red-700";
  if (type === "feature") return "bg-blue-50 text-blue-700";
  return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
}

export default async function AdminFeedbackPage() {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const feedback = (rows ?? []) as Feedback[];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Feedback</h1>
        <Link href="/admin/analytics" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Analytics
        </Link>
        <Link href="/admin/invites" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Invites
        </Link>
        <Link href="/admin/athletes" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Athletes
        </Link>
        <Link href="/admin/lab-partners" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Lab Partners
        </Link>
        <Link href="/admin/brand-partners" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Brand Vault
        </Link>
      </div>

      {feedback.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No feedback submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chipClass(item.type)}`}>
                  {labelFor(item.type)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {item.athlete_name ?? "Unknown"}
                  {item.athlete_email && ` · ${item.athlete_email}`}
                </span>
                <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                  {formatDateTime(item.created_at)}
                </span>
              </div>
              <p className="text-sm text-acl-black dark:text-zinc-100 whitespace-pre-wrap">{item.message}</p>
              {!item.email_sent && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ Email wasn&apos;t delivered (Resend not configured or errored).
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
