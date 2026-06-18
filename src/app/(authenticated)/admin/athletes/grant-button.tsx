"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast-provider";
import { grantCredits } from "./actions";

interface Props {
  athleteId: string;
  athleteName: string;
}

export function GrantButton({ athleteId, athleteName }: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("50");
  const { notify } = useToast();

  function submit() {
    const parsed = parseInt(amount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      notify("Amount must be a positive number.", "error");
      return;
    }
    startTransition(async () => {
      const res = await grantCredits(athleteId, parsed);
      if (!res.ok) {
        notify(res.error ?? "Couldn't grant credits.", "error");
        return;
      }
      notify(`Granted ${parsed} credits to ${athleteName}.`, "success");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-acl-blue hover:underline"
      >
        Grant credits
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-20 rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded bg-acl-orange px-2 py-1 text-xs font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
      >
        {pending ? "..." : "Grant"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-zinc-500 hover:text-zinc-700"
      >
        Cancel
      </button>
    </div>
  );
}
