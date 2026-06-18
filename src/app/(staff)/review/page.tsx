import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";
import { createClient } from "@/lib/supabase/server";
import { advanceContractAclStatus } from "@/lib/contract-actions";

export default async function ReviewQueuePage() {
  const profile = await getStaffProfileOrRedirect();
  if (profile.role !== "acl_admin") redirect("/teams");

  const supabase = await createClient();
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      `
      id, title, brand_name, gross_amount, acl_percentage, created_at,
      organizations ( id, name, default_acl_percentage ),
      teams ( id, name ),
      athletes ( id, full_name ),
      brand_agreement_url, athlete_agreement_url
    `,
    )
    .eq("acl_status", "acl_review")
    .order("created_at", { ascending: true });

  type Joined = {
    id: string;
    title: string | null;
    brand_name: string | null;
    gross_amount: number | null;
    acl_percentage: number | null;
    created_at: string;
    organizations: { id: string; name: string; default_acl_percentage: number } | null;
    teams: { id: string; name: string } | null;
    athletes: { id: string; full_name: string | null } | null;
    brand_agreement_url: string | null;
    athlete_agreement_url: string | null;
  };
  const rows = (contracts ?? []) as unknown as Joined[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-acl-black dark:text-zinc-100">
          ACL review queue
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Deals waiting for ACL to approve the Brand-to-ACL agreement and route
          on to the athlete.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center text-sm text-zinc-500">
          Nothing in the queue. ✓
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => {
            const orgDefault = c.organizations?.default_acl_percentage;
            const effectivePct = c.acl_percentage ?? orgDefault ?? null;
            return (
              <li
                key={c.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/deals/${c.id}`}
                      className="text-base font-semibold text-acl-blue hover:underline"
                    >
                      {c.title ?? "(untitled)"}
                    </Link>
                    <p className="text-xs text-zinc-500 truncate">
                      {c.brand_name ?? "Unnamed brand"} ·{" "}
                      {c.athletes?.full_name ?? "Unknown athlete"} ·{" "}
                      {c.teams?.name ?? "—"}
                      {c.organizations?.name ? ` · ${c.organizations.name}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
                      Gross / %
                    </p>
                    <p className="text-sm font-semibold text-acl-black dark:text-zinc-100">
                      {fmtMoney(c.gross_amount)}{" "}
                      <span className="text-zinc-500">
                        / {effectivePct ?? "—"}%
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-zinc-500">
                    {c.brand_agreement_url ? (
                      <a
                        href={c.brand_agreement_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-acl-blue hover:underline"
                      >
                        Brand agreement →
                      </a>
                    ) : (
                      <span className="text-amber-600">No brand agreement attached</span>
                    )}
                    {c.athlete_agreement_url && (
                      <a
                        href={c.athlete_agreement_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-acl-blue hover:underline"
                      >
                        Athlete agreement →
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await advanceContractAclStatus(c.id, "agreement_attached");
                      }}
                    >
                      <button className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        Send back
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await advanceContractAclStatus(c.id, "active");
                      }}
                    >
                      <button className="rounded-md bg-acl-orange px-3 py-1 text-xs font-semibold text-white hover:bg-acl-orange/90">
                        Approve → Active
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fmtMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}
