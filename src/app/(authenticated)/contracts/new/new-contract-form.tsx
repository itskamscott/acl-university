"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, Pencil, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCredits } from "@/components/credits-provider";
import { EXTRACTION_CREDIT_COST } from "@/lib/contracts/credit-costs";
import { findOrCreateBrand } from "@/lib/brands/resolver";
import type { Brand } from "@/lib/types";

interface Props {
  athleteId: string;
  brands: Pick<Brand, "id" | "business_name">[];
  initialBrandName?: string;
}

type Tab = "upload" | "manual" | "ai";

export function NewContractForm({ athleteId, brands, initialBrandName }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { notify } = useToast();
  const { decrement } = useCredits();
  const [tab, setTab] = useState<Tab>("manual");
  const [saving, setSaving] = useState(false);

  async function resolveBrand(brandName: string, signedAt: string | null): Promise<string | null> {
    const name = brandName.trim();
    if (!name) return null;
    const result = await findOrCreateBrand(supabase, athleteId, name, {
      statusOnCreate: signedAt ? "deal_closed" : "negotiating",
    });
    if (!result.ok) {
      notify(result.error, "error");
      return null;
    }
    if (result.brand.created) {
      notify(`Added "${result.brand.business_name}" to your brands.`, "info");
    }
    return result.brand.id;
  }

  async function createContract(data: {
    title: string;
    brandId: string | null;
    totalValueCents: number | null;
    notes: string | null;
    source: "manual" | "uploaded";
    signedAt: string | null;
  }) {
    const { data: created, error } = await supabase
      .from("contracts")
      .insert({
        athlete_id: athleteId,
        brand_id: data.brandId,
        title: data.title,
        total_value_cents: data.totalValueCents,
        notes: data.notes,
        signed_at: data.signedAt,
        source: data.source,
        status: data.signedAt ? "active" : "draft",
      })
      .select("id")
      .single();
    if (error || !created) {
      notify(error?.message ?? "Couldn't create contract.", "error");
      return null;
    }
    return created.id as string;
  }

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const title = (form.get("title") as string).trim();
    if (!title) {
      notify("Title is required.", "error");
      setSaving(false);
      return;
    }
    const totalValue = form.get("total_value") as string;
    const totalValueCents = totalValue.trim()
      ? Math.round(parseFloat(totalValue) * 100)
      : null;
    const brandNameRaw = ((form.get("brand_name") as string) || "").trim();
    const signedAtRaw = (form.get("signed_at") as string) || null;
    const notes = ((form.get("notes") as string) || "").trim() || null;

    const brandId = brandNameRaw ? await resolveBrand(brandNameRaw, signedAtRaw) : null;
    if (brandNameRaw && !brandId) {
      setSaving(false);
      return;
    }

    const contractId = await createContract({
      title,
      brandId,
      totalValueCents,
      notes,
      source: "manual",
      signedAt: signedAtRaw,
    });

    setSaving(false);
    if (contractId) {
      notify("Contract created.", "success");
      router.push(`/contracts/${contractId}`);
      router.refresh();
    }
  }

  return (
    <>
      {/* Tabs */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-lg border p-3 text-left transition-colors ${
            tab === "upload"
              ? "border-acl-orange bg-acl-orange/5"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
          }`}
        >
          <Upload className="h-4 w-4 text-acl-orange" />
          <p className="mt-2 text-sm font-medium text-acl-black dark:text-zinc-100">Upload</p>
          <p className="mt-0.5 text-xs text-zinc-500">A brand sent you one</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`rounded-lg border p-3 text-left transition-colors ${
            tab === "manual"
              ? "border-acl-orange bg-acl-orange/5"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
          }`}
        >
          <Pencil className="h-4 w-4 text-acl-orange" />
          <p className="mt-2 text-sm font-medium text-acl-black dark:text-zinc-100">Manual</p>
          <p className="mt-0.5 text-xs text-zinc-500">Track one without a file</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("ai")}
          className={`rounded-lg border p-3 text-left transition-colors ${
            tab === "ai"
              ? "border-acl-orange bg-acl-orange/5"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
          }`}
        >
          <Sparkles className="h-4 w-4 text-acl-orange" />
          <p className="mt-2 text-sm font-medium text-acl-black dark:text-zinc-100">AI generate</p>
          <p className="mt-0.5 text-xs text-zinc-500">Let the AI Assistant draft it</p>
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === "upload" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              const form = new FormData(e.currentTarget);
              const title = (form.get("title") as string).trim();
              const file = form.get("file") as File | null;
              if (!title || !file || file.size === 0) {
                notify("Title and a file are both required.", "error");
                setSaving(false);
                return;
              }
              if (file.size > 20 * 1024 * 1024) {
                notify("File must be under 20MB.", "error");
                setSaving(false);
                return;
              }
              const totalValueRaw = form.get("total_value") as string;
              const totalValueCents = totalValueRaw.trim()
                ? Math.round(parseFloat(totalValueRaw) * 100)
                : null;
              const brandNameRaw = ((form.get("brand_name") as string) || "").trim();
              const signedAtRaw = (form.get("signed_at") as string) || null;
              const notes = ((form.get("notes") as string) || "").trim() || null;

              const brandId = brandNameRaw
                ? await resolveBrand(brandNameRaw, signedAtRaw)
                : null;
              if (brandNameRaw && !brandId) {
                setSaving(false);
                return;
              }

              const contractId = await createContract({
                title,
                brandId,
                totalValueCents,
                notes,
                source: "uploaded",
                signedAt: signedAtRaw,
              });
              if (!contractId) {
                setSaving(false);
                return;
              }

              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              const path = `${athleteId}/${contractId}/${safeName}`;
              const { error: uploadError } = await supabase.storage
                .from("contracts")
                .upload(path, file, { upsert: false });
              if (uploadError) {
                notify(
                  `Contract created but file upload failed: ${uploadError.message}. Attach the file from the detail page.`,
                  "error",
                );
                router.push(`/contracts/${contractId}`);
                router.refresh();
                return;
              }

              await supabase
                .from("contracts")
                .update({ contract_file_path: path })
                .eq("id", contractId);

              // Kick off auto-extraction for PDFs and images — don't block
              // the redirect on it, just surface the result via toast.
              notify(`Uploaded. Analyzing the contract now (${EXTRACTION_CREDIT_COST} credits)…`, "info");
              fetch(`/api/contracts/${contractId}/extract`, { method: "POST" })
                .then((res) => res.json().catch(() => null))
                .then((data) => {
                  if (!data) return;
                  if (data.ok) {
                    const charged = typeof data.credits_used === "number" ? data.credits_used : 0;
                    if (charged > 0) decrement(charged);
                    if (data.brand_created && data.brand_linked) {
                      notify(`Added "${data.brand_linked}" to your brands.`, "info");
                    }
                    const bits: string[] = [];
                    if (data.deliverables_added > 0) bits.push(`${data.deliverables_added} deliverables`);
                    if (data.payments_added > 0) bits.push(`${data.payments_added} payments`);
                    if (bits.length > 0) {
                      notify(
                        `Auto-filled ${bits.join(" + ")} (−${charged} credits). Review below.`,
                        "success",
                      );
                    } else {
                      notify(
                        `Couldn't spot any deliverables or payments${charged > 0 ? ` (−${charged} credits)` : ""} — add them manually.`,
                        "info",
                      );
                    }
                    router.refresh();
                  } else if (data.error) {
                    notify(`Auto-extract skipped: ${data.error}`, "error");
                  }
                })
                .catch(() => {
                  notify("Couldn't analyze the contract. You can retry from the detail page.", "error");
                });
              router.push(`/contracts/${contractId}`);
              router.refresh();
              setSaving(false);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Title *</label>
              <input
                name="title"
                required
                placeholder="e.g. Main Street Pizza — Spring Gameday Deal"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Contract file *</label>
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                className="w-full text-sm text-zinc-700 dark:text-zinc-200 file:mr-3 file:rounded-lg file:border-0 file:bg-acl-orange file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-acl-orange/90"
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                PDF or image gets auto-analyzed after upload ({EXTRACTION_CREDIT_COST} credits).
                DOC, DOCX, and TXT upload fine but skip auto-extract. Max 20MB.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Brand (optional)</label>
              <select
                name="brand_id"
                defaultValue=""
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              >
                <option value="">—</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.business_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Total value (USD)</label>
                <input
                  name="total_value"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Signed date</label>
                <input
                  name="signed_at"
                  type="date"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Notes</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                {saving ? "Uploading..." : "Upload contract"}
              </button>
              <Link
                href="/contracts"
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}

        {tab === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                Title *
              </label>
              <input
                name="title"
                required
                placeholder="e.g. Main Street Pizza — Spring Gameday Deal"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                Brand (optional)
              </label>
              <input
                name="brand_name"
                list="brand-options"
                defaultValue={initialBrandName ?? ""}
                placeholder="Type a brand name — we'll add it if it's new"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              />
              <datalist id="brand-options">
                {brands.map((b) => (
                  <option key={b.id} value={b.business_name} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Total value (USD)
                </label>
                <input
                  name="total_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="500"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Signed date
                </label>
                <input
                  name="signed_at"
                  type="date"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Payment terms, usage rights, anything to remember..."
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create contract"}
              </button>
              <Link
                href="/contracts"
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}

        {tab === "ai" && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
            <p className="text-sm text-acl-black dark:text-zinc-100">
              Ask your AI Assistant to draft one for you. Try something like:
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-xs text-zinc-700">
              Generate a contract with Main Street Pizza for a $500 deal.
              Deliverables: 2 Instagram posts and 1 in-store appearance
              over 3 weeks. 50% upfront, 50% on completion.
            </pre>
            <p className="mt-4 text-xs text-zinc-500">
              The AI Assistant can either draft the text for you to copy into
              Manual, or (coming in the next push) create the contract row
              directly via tool use.
            </p>
            <Link
              href="/coach"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
            >
              <Sparkles className="h-4 w-4" />
              Open AI Assistant
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
