"use client";

import { useState, useTransition } from "react";
import { setContractAclPercentage, setContractGrossAmount } from "@/lib/contract-actions";

export function AmountEditor({
  contractId,
  current,
}: {
  contractId: string;
  current: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div>
        <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Gross amount</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-lg font-bold text-acl-black dark:text-zinc-100">
            {current === null
              ? "—"
              : new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 2,
                }).format(current)}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-acl-blue hover:underline"
          >
            edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Gross amount</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="w-28 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
          placeholder="0.00"
        />
        <button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const n = parseFloat(value);
              if (Number.isNaN(n)) {
                setError("Invalid amount");
                return;
              }
              const r = await setContractGrossAmount(contractId, n);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setEditing(false);
            });
          }}
          className="rounded-md bg-acl-orange px-2 py-1 text-xs font-semibold text-white hover:bg-acl-orange/90 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(current?.toString() ?? "");
          }}
          className="text-xs text-zinc-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

export function PercentageEditor({
  contractId,
  current,
  disabled,
}: {
  contractId: string;
  current: number | null;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div>
        <p className="text-[11px] text-zinc-500 uppercase tracking-wide">ACL percentage</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-lg font-bold text-acl-black dark:text-zinc-100">
            {current === null ? "default" : `${current}%`}
          </p>
          {!disabled && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-acl-blue hover:underline"
            >
              edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide">ACL percentage</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
          placeholder="20.00"
        />
        <span className="text-sm text-zinc-500">%</span>
        <button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const n = parseFloat(value);
              if (Number.isNaN(n)) {
                setError("Invalid percentage");
                return;
              }
              const r = await setContractAclPercentage(contractId, n);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setEditing(false);
            });
          }}
          className="rounded-md bg-acl-orange px-2 py-1 text-xs font-semibold text-white hover:bg-acl-orange/90 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(current?.toString() ?? "");
          }}
          className="text-xs text-zinc-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
