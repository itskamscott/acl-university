"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { celebrateWin } from "@/components/win-celebration";
import { CONTRACT_STATUSES } from "@/lib/types";
import type {
  Contract,
  ContractPayment,
  ContractStatus,
  Deliverable,
} from "@/lib/types";
import { DeliverablesSection } from "./deliverables-section";
import { PaymentsSection } from "./payments-section";
import { FileSection } from "./file-section";

interface Props {
  contract: Contract & { brands: { id: string; business_name: string } | null };
  deliverables: Deliverable[];
  payments: ContractPayment[];
  athleteId: string;
}

function formatCents(cents: number | null, currency: string): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status: ContractStatus): string {
  if (status === "draft") return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600";
  if (status === "active") return "bg-blue-50 text-blue-700";
  if (status === "completed") return "bg-green-50 text-green-700";
  return "bg-red-50 text-red-700";
}

export function ContractDetailClient({
  contract: initialContract,
  deliverables,
  payments,
  athleteId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { notify } = useToast();
  const [contract, setContract] = useState(initialContract);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  const statusLabel =
    CONTRACT_STATUSES.find((s) => s.value === contract.status)?.label ?? contract.status;

  const totalPaid = payments
    .filter((p) => p.received_at !== null)
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const completedDeliverables = deliverables.filter((d) => d.completed_at !== null).length;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const totalValueRaw = form.get("total_value") as string;
    const updates = {
      title: (form.get("title") as string).trim(),
      status: form.get("status") as ContractStatus,
      total_value_cents: totalValueRaw.trim()
        ? Math.round(parseFloat(totalValueRaw) * 100)
        : null,
      signed_at: (form.get("signed_at") as string) || null,
      notes: ((form.get("notes") as string) || "").trim() || null,
    };

    const { data, error } = await supabase
      .from("contracts")
      .update(updates)
      .eq("id", contract.id)
      .select("*, brands(id, business_name)")
      .single();

    if (error || !data) {
      notify(error?.message ?? "Couldn't save.", "error");
      setSaving(false);
      return;
    }
    // Celebrate transitions: draft/anything -> active OR newly-set signed_at
    // counts as "signed". status -> "completed" counts as completed.
    const becameSigned =
      (updates.status === "active" && contract.status !== "active") ||
      (!!updates.signed_at && !contract.signed_at);
    const becameCompleted =
      updates.status === "completed" && contract.status !== "completed";
    const subject = contract.title;

    setContract(data as typeof contract);
    setEditing(false);
    setSaving(false);
    notify("Contract updated.", "success");

    if (becameSigned && !becameCompleted) {
      celebrateWin({ kind: "contract_signed", subject });
    } else if (becameCompleted) {
      celebrateWin({ kind: "contract_completed", subject });
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${contract.title}" and all its deliverables and payments? This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("contracts").delete().eq("id", contract.id);
    if (error) {
      notify(error.message, "error");
      setDeleting(false);
      return;
    }
    notify("Contract deleted.", "success");
    router.push("/contracts");
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contracts
      </Link>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Title</label>
            <input
              name="title"
              defaultValue={contract.title}
              required
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Status</label>
              <select name="status" defaultValue={contract.status} className={inputClass}>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Signed date</label>
              <input
                name="signed_at"
                type="date"
                defaultValue={contract.signed_at ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Total value (USD)</label>
            <input
              name="total_value"
              type="number"
              step="0.01"
              min="0"
              defaultValue={contract.total_value_cents !== null ? contract.total_value_cents / 100 : ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={contract.notes ?? ""}
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
              {deleting ? "Deleting..." : "Delete contract"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">{contract.title}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {contract.brands ? (
                  <Link href={`/brands/${contract.brands.id}`} className="hover:text-acl-black dark:hover:text-zinc-100">
                    {contract.brands.business_name}
                  </Link>
                ) : (
                  "No brand linked"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(contract.status)}`}>
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Total value</p>
              <p className="mt-0.5 text-sm font-semibold text-acl-black dark:text-zinc-100">
                {formatCents(contract.total_value_cents, contract.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Paid</p>
              <p className="mt-0.5 text-sm font-semibold text-acl-black dark:text-zinc-100">
                {totalPaid === 0 && payments.length === 0
                  ? "—"
                  : formatCents(totalPaid, contract.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Deliverables</p>
              <p className="mt-0.5 text-sm font-semibold text-acl-black dark:text-zinc-100">
                {deliverables.length === 0
                  ? "—"
                  : `${completedDeliverables} / ${deliverables.length}`}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Signed</p>
              <p className="mt-0.5 text-sm font-semibold text-acl-black dark:text-zinc-100">
                {formatDate(contract.signed_at)}
              </p>
            </div>
          </div>

          {contract.notes && (
            <div className="mb-6">
              <p className="text-xs text-zinc-400 mb-1">Notes</p>
              <p className="text-sm text-acl-black dark:text-zinc-100 whitespace-pre-wrap">{contract.notes}</p>
            </div>
          )}

          {contract.generated_content && (
            <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  AI-generated draft
                </p>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Copy into a doc before signing</span>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-acl-black dark:text-zinc-100">
                {contract.generated_content}
              </pre>
            </div>
          )}

          <div className="space-y-4">
            <FileSection
              contractId={contract.id}
              athleteId={athleteId}
              initialPath={contract.contract_file_path}
            />
            <DeliverablesSection
              contractId={contract.id}
              athleteId={athleteId}
              initial={deliverables}
            />
            <PaymentsSection
              contractId={contract.id}
              athleteId={athleteId}
              currency={contract.currency}
              initial={payments}
            />
          </div>
        </>
      )}
    </div>
  );
}
