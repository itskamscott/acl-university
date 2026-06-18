"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Paperclip, Sparkles, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCredits } from "@/components/credits-provider";
import { EXTRACTION_CREDIT_COST } from "@/lib/contracts/credit-costs";

interface Props {
  contractId: string;
  athleteId: string;
  initialPath: string | null;
}

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function FileSection({ contractId, athleteId, initialPath }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { notify } = useToast();
  const { decrement } = useCredits();
  const [path, setPath] = useState<string | null>(initialPath);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleReanalyze() {
    if (!path) return;
    if (
      !window.confirm(
        `Analyze this file and add any new deliverables and payments it finds? Costs ${EXTRACTION_CREDIT_COST} credits.`,
      )
    ) {
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/extract`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        notify(data?.error ?? "Couldn't analyze the file.", "error");
        setAnalyzing(false);
        return;
      }
      const charged = typeof data.credits_used === "number" ? data.credits_used : 0;
      if (charged > 0) decrement(charged);
      if (data.brand_created && data.brand_linked) {
        notify(`Added "${data.brand_linked}" to your brands.`, "info");
      }
      const bits: string[] = [];
      if (data.deliverables_added > 0) bits.push(`${data.deliverables_added} deliverables`);
      if (data.payments_added > 0) bits.push(`${data.payments_added} payments`);
      notify(
        bits.length > 0
          ? `Added ${bits.join(" + ")} (−${charged} credits).`
          : `No new deliverables or payments found${charged > 0 ? ` (−${charged} credits)` : ""}.`,
        bits.length > 0 ? "success" : "info",
      );
      router.refresh();
    } catch {
      notify("Couldn't analyze the file.", "error");
    }
    setAnalyzing(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      notify("File must be under 20MB.", "error");
      e.target.value = "";
      return;
    }
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const newPath = `${athleteId}/${contractId}/${safeName}`;

    if (path && path !== newPath) {
      await supabase.storage.from("contracts").remove([path]);
    }

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(newPath, file, { upsert: true });
    if (uploadError) {
      notify(uploadError.message, "error");
      setBusy(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("contracts")
      .update({ contract_file_path: newPath })
      .eq("id", contractId);
    if (updateError) {
      notify(updateError.message, "error");
      setBusy(false);
      return;
    }
    setPath(newPath);
    notify("File uploaded.", "success");
    e.target.value = "";
    setBusy(false);
  }

  async function handleView() {
    if (!path) return;
    setBusy(true);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(path, 60);
    setBusy(false);
    if (error || !data) {
      notify(error?.message ?? "Couldn't load file.", "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleRemove() {
    if (!path) return;
    if (!window.confirm("Remove the uploaded contract file?")) return;
    setBusy(true);
    await supabase.storage.from("contracts").remove([path]);
    const { error } = await supabase
      .from("contracts")
      .update({ contract_file_path: null })
      .eq("id", contractId);
    if (error) {
      notify(error.message, "error");
      setBusy(false);
      return;
    }
    setPath(null);
    notify("File removed.", "success");
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
      <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100 mb-3">Contract file</h2>

      {path ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            <Paperclip className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-acl-black dark:text-zinc-100 truncate">
              {fileNameFromPath(path)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Private — only you can access this link.</p>
          </div>
          <button
            type="button"
            onClick={handleView}
            disabled={busy || analyzing}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            View
          </button>
          <button
            type="button"
            onClick={handleReanalyze}
            disabled={busy || analyzing}
            className="inline-flex items-center gap-1 rounded-lg border border-acl-orange bg-acl-orange/5 px-3 py-1.5 text-xs font-medium text-acl-orange hover:bg-acl-orange/10 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {analyzing ? "Analyzing..." : `Re-analyze (${EXTRACTION_CREDIT_COST} cr)`}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || analyzing}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />
            Replace
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy || analyzing}
            className="text-zinc-400 hover:text-red-600 disabled:opacity-50"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-zinc-500 mb-3">No file attached yet.</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {busy ? "Uploading..." : "Attach file"}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
