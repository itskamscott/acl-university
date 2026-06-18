"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { celebrateWin } from "@/components/win-celebration";
import type { ContractPayment } from "@/lib/types";

interface Props {
  contractId: string;
  athleteId: string;
  currency: string;
  initial: ContractPayment[];
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PaymentsSection({ contractId, athleteId, currency, initial }: Props) {
  const supabase = createClient();
  const { notify } = useToast();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      notify("Enter a positive amount.", "error");
      return;
    }
    setSaving(true);

    const { data, error } = await supabase
      .from("contract_payments")
      .insert({
        contract_id: contractId,
        athlete_id: athleteId,
        amount_cents: Math.round(parsed * 100),
        currency,
        due_date: dueDate || null,
        received_at: receivedAt || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (error || !data) {
      notify(error?.message ?? "Couldn't add payment.", "error");
      setSaving(false);
      return;
    }

    setItems((prev) => [...prev, data as ContractPayment]);
    setAmount("");
    setDueDate("");
    setReceivedAt("");
    setNotes("");
    setOpen(false);
    setSaving(false);
    notify("Payment added.", "success");
  }

  async function toggleReceived(item: ContractPayment) {
    const becameReceived = !item.received_at;
    const nextValue = item.received_at ? null : new Date().toISOString().split("T")[0];
    const previousItems = items;
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, received_at: nextValue } : p)),
    );
    const { error } = await supabase
      .from("contract_payments")
      .update({ received_at: nextValue })
      .eq("id", item.id);
    if (error) {
      setItems(previousItems);
      notify("Couldn't update.", "error");
      return;
    }
    if (becameReceived) {
      celebrateWin({
        kind: "payment_received",
        subject: formatCents(item.amount_cents, item.currency),
      });
    }
  }

  async function handleDelete(item: ContractPayment) {
    if (!window.confirm(`Remove this payment of ${formatCents(item.amount_cents, item.currency)}?`)) return;
    const previousItems = items;
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    const { error } = await supabase.from("contract_payments").delete().eq("id", item.id);
    if (error) {
      setItems(previousItems);
      notify("Couldn't delete.", "error");
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Payments</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-acl-blue hover:underline"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {items.length === 0 && !open && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No payments tracked yet.</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const isReceived = item.received_at !== null;
            const isOverdue =
              item.due_date && !isReceived && item.due_date < today;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-md border border-zinc-100 dark:border-zinc-800 p-2"
              >
                <button
                  type="button"
                  onClick={() => toggleReceived(item)}
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isReceived
                      ? "bg-green-50 text-green-700"
                      : isOverdue
                      ? "bg-red-50 text-red-600"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                  }`}
                >
                  {isReceived ? "Received" : isOverdue ? "Overdue" : "Pending"}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-acl-black dark:text-zinc-100">
                    {formatCents(item.amount_cents, item.currency)}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isReceived
                      ? `Received ${formatDate(item.received_at)}`
                      : item.due_date
                      ? `Due ${formatDate(item.due_date)}`
                      : "No due date"}
                    {item.notes && ` · ${item.notes}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="text-zinc-300 hover:text-red-600"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <form onSubmit={handleAdd} className="mt-3 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              placeholder="Amount (USD)"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="Due date"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              placeholder="Received date (optional)"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note (e.g. 50% deposit)"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !amount}
              className="rounded-lg bg-acl-orange px-3 py-2 text-xs font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setAmount("");
                setDueDate("");
                setReceivedAt("");
                setNotes("");
              }}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
