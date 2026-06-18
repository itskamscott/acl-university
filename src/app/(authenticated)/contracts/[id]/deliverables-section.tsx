"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import type { Deliverable } from "@/lib/types";

interface Props {
  contractId: string;
  athleteId: string;
  initial: Deliverable[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function DeliverablesSection({ contractId, athleteId, initial }: Props) {
  const supabase = createClient();
  const { notify } = useToast();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const content = description.trim();
    if (!content) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("deliverables")
      .insert({
        contract_id: contractId,
        athlete_id: athleteId,
        description: content,
        due_date: dueDate || null,
        order_index: items.length,
      })
      .select()
      .single();

    if (error || !data) {
      notify(error?.message ?? "Couldn't add deliverable.", "error");
      setSaving(false);
      return;
    }

    setItems((prev) => [...prev, data as Deliverable]);
    setDescription("");
    setDueDate("");
    setOpen(false);
    setSaving(false);
    notify("Deliverable added.", "success");
  }

  async function toggleComplete(item: Deliverable) {
    const nextCompleted = item.completed_at ? null : new Date().toISOString();
    const previousItems = items;
    setItems((prev) =>
      prev.map((d) => (d.id === item.id ? { ...d, completed_at: nextCompleted } : d)),
    );
    const { error } = await supabase
      .from("deliverables")
      .update({ completed_at: nextCompleted })
      .eq("id", item.id);
    if (error) {
      setItems(previousItems);
      notify("Couldn't update.", "error");
    }
  }

  async function handleDelete(item: Deliverable) {
    if (!window.confirm(`Remove "${item.description}"?`)) return;
    const previousItems = items;
    setItems((prev) => prev.filter((d) => d.id !== item.id));
    const { error } = await supabase.from("deliverables").delete().eq("id", item.id);
    if (error) {
      setItems(previousItems);
      notify("Couldn't delete.", "error");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Deliverables</h2>
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
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No deliverables yet.</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const isComplete = item.completed_at !== null;
            const isOverdue =
              item.due_date && !isComplete && item.due_date < new Date().toISOString().split("T")[0];
            return (
              <li key={item.id} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleComplete(item)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    isComplete
                      ? "bg-acl-orange border-acl-orange text-white"
                      : "border-zinc-300 hover:border-acl-orange"
                  }`}
                  aria-label={isComplete ? "Mark as not done" : "Mark as done"}
                >
                  {isComplete && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      isComplete ? "text-zinc-400 line-through" : "text-acl-black dark:text-zinc-100"
                    }`}
                  >
                    {item.description}
                  </p>
                  {item.due_date && (
                    <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600" : "text-zinc-400 dark:text-zinc-500"}`}>
                      Due {formatDate(item.due_date)}
                      {isOverdue && " · overdue"}
                    </p>
                  )}
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
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            autoFocus
            placeholder="e.g. 1 Instagram post with branded hashtag"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
            />
            <button
              type="submit"
              disabled={saving || !description.trim()}
              className="rounded-lg bg-acl-orange px-3 py-2 text-xs font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDescription("");
                setDueDate("");
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
