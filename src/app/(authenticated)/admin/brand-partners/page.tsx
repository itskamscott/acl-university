import Link from "next/link";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandPartner } from "@/lib/types";
import { BrandPartnerManager } from "./brand-partner-manager";

export const metadata = { title: "Admin — Brand Vault" };

export default async function AdminBrandPartnersPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // Service-role bypasses RLS so admins see inactive rows too.
  const { data: brands } = await admin
    .from("brand_partners")
    .select("*")
    .order("is_active", { ascending: false })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Reveal counts per brand → handy lifetime metric for the admin list.
  const { data: revealRows } = await admin.from("reveals").select("brand_partner_id");
  const revealCountByBrand = new Map<string, number>();
  for (const r of revealRows ?? []) {
    const id = (r as { brand_partner_id: string }).brand_partner_id;
    revealCountByBrand.set(id, (revealCountByBrand.get(id) ?? 0) + 1);
  }

  // Drop-email coverage per brand for the "X emailed" indicator.
  const { data: dropRows } = await admin
    .from("brand_drop_emails")
    .select("brand_partner_id");
  const dropCountByBrand = new Map<string, number>();
  for (const r of dropRows ?? []) {
    const id = (r as { brand_partner_id: string }).brand_partner_id;
    dropCountByBrand.set(id, (dropCountByBrand.get(id) ?? 0) + 1);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center gap-4 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
          Brand Vault
        </h1>
        <Link href="/admin/analytics" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Analytics
        </Link>
        <Link href="/admin/athletes" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Athletes
        </Link>
        <Link href="/admin/lab-partners" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Lab Partners
        </Link>
        <Link href="/admin/invites" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Invites
        </Link>
        <Link href="/admin/feedback" className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100">
          Feedback
        </Link>
      </div>
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <p className="text-sm text-zinc-500">
          Curate the offers athletes see at /vault. Inactive brands stay in the
          list here but disappear from the athlete-facing grid.
        </p>
        <Link
          href="/admin/brand-partners/analytics"
          className="text-xs font-medium text-acl-blue hover:underline"
        >
          View reveal analytics →
        </Link>
      </div>

      <BrandPartnerManager
        brands={(brands ?? []) as BrandPartner[]}
        revealCounts={Object.fromEntries(revealCountByBrand)}
        dropEmailCounts={Object.fromEntries(dropCountByBrand)}
      />
    </div>
  );
}
