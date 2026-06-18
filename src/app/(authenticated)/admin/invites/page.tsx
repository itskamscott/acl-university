import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteActions } from "./invite-actions";
import { describeTouchedAge } from "@/lib/utils";
import type { InviteCode } from "@/lib/types";

export const metadata = { title: "Admin — Invite Codes" };

export default async function AdminInvitesPage() {
  const admin = createAdminClient();

  const { data: codes } = await admin
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: claimedAthletes } = await admin
    .from("athletes")
    .select("id, full_name, email")
    .in("id", (codes ?? []).map((c) => c.used_by).filter(Boolean) as string[]);

  const athletesById = new Map(
    (claimedAthletes ?? []).map((a) => [a.id as string, a]),
  );

  const inviteCodes = (codes ?? []) as InviteCode[];
  const now = new Date();
  const unusedCount = inviteCodes.filter((c) => c.used_by === null).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center gap-4 mb-1">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Invite Codes</h1>
        <Link href="/admin/analytics" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Analytics
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
        <Link href="/admin/feedback" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Feedback
        </Link>
        <div className="ml-auto">
          <InviteActions />
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        {inviteCodes.length} total · {unusedCount} available
      </p>

      {inviteCodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No invite codes yet. Generate one above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sent to / Claimed by</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {inviteCodes.map((code) => {
                const claimer = code.used_by ? athletesById.get(code.used_by) : null;
                const isAvailable = code.used_by === null;
                return (
                  <tr key={code.id} className="text-zinc-700">
                    <td className="px-4 py-2 font-mono">{code.code}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isAvailable
                            ? "bg-green-50 text-green-700"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                        }`}
                      >
                        {isAvailable ? "Available" : "Used"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {claimer
                        ? `${claimer.full_name} (${claimer.email})`
                        : code.invited_email
                        ? `📧 ${code.invited_email}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {describeTouchedAge(code.created_at, now)}
                    </td>
                    <td className="px-4 py-2">
                      {isAvailable && (
                        <InviteActions
                          revokeId={code.id}
                          revokeCode={code.code}
                          resendEmail={code.invited_email}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
