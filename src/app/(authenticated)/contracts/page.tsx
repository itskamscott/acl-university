import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { CONTRACT_STATUSES } from "@/lib/types";
import type { Contract } from "@/lib/types";
import { HelpTooltip } from "@/components/help-tooltip";

export const metadata = { title: "Contracts" };

function formatCents(cents: number | null, currency: string): string {
  if (cents === null) return "—";
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function statusClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
    case "active":
      return "bg-blue-50 text-blue-700";
    case "completed":
      return "bg-green-50 text-green-700";
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
  }
}

export default async function ContractsPage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, brands(business_name)")
    .eq("athlete_id", athlete.id)
    .order("created_at", { ascending: false });

  const list = (contracts ?? []) as (Contract & { brands: { business_name: string } | null })[];

  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Contracts</h1>
          <HelpTooltip text="Track deals on paper. Upload PDFs and the assistant extracts terms; or enter manually. Deliverables and payments live on each contract." />
        </div>
        <Link
          href="/contracts/new"
          className="flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
        >
          <Plus className="h-4 w-4" />
          New Contract
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 md:p-8">
          <div className="max-w-md mx-auto text-center">
            <FileText className="h-8 w-8 text-acl-orange/70 mx-auto" />
            <p className="mt-3 text-base font-semibold text-acl-black dark:text-zinc-100">
              Track every deal on paper
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Contracts hold the agreement, deliverables you owe, and payments
              you&apos;re owed. Get them in here and the assistant will help
              you stay on top of every line.
            </p>
          </div>

          <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            <Link
              href="/contracts/new?tab=upload"
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors text-left"
            >
              <p className="text-xs font-semibold text-acl-black dark:text-zinc-100">Upload a PDF</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                The brand sent you something? Drop it here — we&apos;ll extract terms.
              </p>
            </Link>
            <Link
              href="/contracts/new"
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors text-left"
            >
              <p className="text-xs font-semibold text-acl-black dark:text-zinc-100">Enter manually</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Quick form — title, value, deliverables, payment terms.
              </p>
            </Link>
            <Link
              href="/coach"
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 hover:border-zinc-300 transition-colors text-left"
            >
              <p className="text-xs font-semibold text-acl-black dark:text-zinc-100">Have AI draft one</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Tell the assistant the deal terms; it writes the contract.
              </p>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => {
            const statusLabel = CONTRACT_STATUSES.find((s) => s.value === c.status)?.label ?? c.status;
            const brandName = c.brands?.business_name;
            return (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="flex items-start justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 hover:border-zinc-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">
                    {c.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {brandName ? brandName : "No brand linked"}
                    {c.total_value_cents !== null && (
                      <>
                        <span className="mx-1.5 text-zinc-300">·</span>
                        {formatCents(c.total_value_cents, c.currency)}
                      </>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(c.status)}`}>
                  {statusLabel}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
