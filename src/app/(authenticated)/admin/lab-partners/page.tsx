import Link from "next/link";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AthleteTier, Pod, PodMembership } from "@/lib/types";
import { LabPartnerManager } from "./lab-partner-manager";

export const metadata = { title: "Admin — Lab Partners" };

export default async function AdminLabPartnersPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [athletesRes, podsRes, membershipsRes] = await Promise.all([
    admin
      .from("athletes")
      .select("id, full_name, email, tier")
      .order("full_name", { ascending: true }),
    admin
      .from("pods")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("pod_memberships")
      .select("*")
      .is("left_at", null),
  ]);

  const athletes = (athletesRes.data ?? []) as {
    id: string;
    full_name: string;
    email: string;
    tier: AthleteTier;
  }[];
  const pods = (podsRes.data ?? []) as Pod[];
  const memberships = (membershipsRes.data ?? []) as PodMembership[];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center gap-4 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
          Lab Partners
        </h1>
        <Link href="/admin/analytics" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Analytics
        </Link>
        <Link href="/admin/athletes" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Athletes
        </Link>
        <Link href="/admin/invites" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Invites
        </Link>
        <Link href="/admin/brand-partners" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Brand Vault
        </Link>
        <Link href="/admin/feedback" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Feedback
        </Link>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        Run the program: change athlete tiers, mint pods, assign Insiders. Founders are managed via the database (is_admin flag).
      </p>

      <LabPartnerManager
        athletes={athletes}
        pods={pods}
        memberships={memberships}
      />
    </div>
  );
}
