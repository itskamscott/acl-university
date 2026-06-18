"use client";

import { useState, useTransition } from "react";
import { Mail, Plus } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { createInviteCode, inviteByEmail, resendInviteEmail, revokeInviteCode } from "./actions";

interface Props {
  revokeId?: string;
  revokeCode?: string;
  resendEmail?: string | null;
}

export function InviteActions({ revokeId, revokeCode, resendEmail }: Props) {
  const [pending, startTransition] = useTransition();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const { notify } = useToast();

  // Per-row mode: revoke is always available; resend only when the invite
  // was originally sent to a specific email (so we know who to send it to).
  if (revokeId) {
    return (
      <div className="flex items-center gap-3">
        {resendEmail && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await resendInviteEmail(revokeId);
                if (!res.ok) {
                  notify(res.error, "error");
                  return;
                }
                notify(`Resent to ${resendEmail}.`, "success");
              });
            }}
            className="text-xs font-medium text-acl-blue hover:underline disabled:opacity-50"
          >
            {pending ? "..." : "Resend"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Revoke invite code ${revokeCode}?`)) return;
            startTransition(async () => {
              const res = await revokeInviteCode(revokeId);
              if (!res.ok) {
                notify(res.error ?? "Couldn't revoke.", "error");
                return;
              }
              notify("Invite code revoked.", "success");
            });
          }}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {pending ? "Revoking..." : "Revoke"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setEmailOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        <Mail className="h-4 w-4" />
        Invite by email
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await createInviteCode();
            if (!res.ok) {
              notify(res.error, "error");
              return;
            }
            await navigator.clipboard?.writeText(res.code).catch(() => {});
            notify(`Generated ${res.code} (copied)`, "success");
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {pending ? "..." : "New code"}
      </button>

      {emailOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:p-4 sm:items-center"
          onClick={() => !pending && setEmailOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-2xl max-h-[90dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-acl-black dark:text-zinc-100">Invite by email</h2>
            <p className="mt-1 text-xs text-zinc-500">
              We&apos;ll generate a code and email a ready-to-use signup link.
            </p>

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) return;
                startTransition(async () => {
                  const res = await inviteByEmail(email.trim());
                  if (!res.ok) {
                    notify(res.error, "error");
                    return;
                  }
                  notify(
                    res.emailSent
                      ? `Invite sent to ${email.trim()} (code ${res.code}).`
                      : `Code ${res.code} generated. Email didn't send — share manually.`,
                    res.emailSent ? "success" : "error",
                  );
                  setEmail("");
                  setEmailOpen(false);
                });
              }}
            >
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="athlete@school.edu"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending || !email.trim()}
                  className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
                >
                  {pending ? "Sending..." : "Send invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailOpen(false)}
                  disabled={pending}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
