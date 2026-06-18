import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import type { AthleteTier } from "@/lib/types";
import { AthletesTable } from "./athletes-table";

export const metadata = { title: "Admin — Athletes" };

export default async function AdminAthletesPage() {
  const admin = createAdminClient();

  const { data: athletes } = await admin
    .from("athletes")
    .select("id, full_name, email, school, sport, credits, is_admin, tier, created_at")
    .order("created_at", { ascending: false });

  const list = (athletes ?? []) as {
    id: string;
    full_name: string;
    email: string;
    school: string | null;
    sport: string | null;
    credits: number;
    is_admin: boolean;
    tier: AthleteTier;
  }[];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Athletes</h1>
        <Link href="/admin/analytics" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Analytics
        </Link>
        <Link href="/admin/invites" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Invite codes
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
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No athletes yet.</p>
        </div>
      ) : (
        <AthletesTable athletes={list} />
      )}
    </div>
  );
}
