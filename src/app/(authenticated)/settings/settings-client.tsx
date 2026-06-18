"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import type { Athlete } from "@/lib/types";
import { CREDIT_TIERS, formatDollars } from "@/lib/credit-tiers";
import { SKOOL_COMMUNITY_URL } from "@/lib/links";
import { FeedbackButton } from "@/components/feedback-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushToggle } from "@/components/push-toggle";
import { SignOutButton } from "./sign-out-button";

interface Props {
  athlete: Athlete;
}

export function SettingsClient({ athlete: initialAthlete }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();
  const [athlete, setAthlete] = useState(initialAthlete);

  useEffect(() => {
    const purchase = searchParams.get("purchase");
    if (purchase === "success") {
      notify("Credits added. Thanks!", "success");
      router.replace("/settings#credits");
      setTimeout(() => router.refresh(), 1500);
    } else if (purchase === "cancelled") {
      notify("Checkout cancelled.", "info");
      router.replace("/settings#credits");
    }
  }, [searchParams, notify, router]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [purchaseLoadingTier, setPurchaseLoadingTier] = useState<string | null>(null);

  async function toggleEmailPref(
    field: "email_follow_up_reminders" | "email_weekly_digest" | "email_brand_drops",
    next: boolean,
  ) {
    const previous = athlete;
    setAthlete({ ...athlete, [field]: next });
    const { error } = await supabase
      .from("athletes")
      .update({ [field]: next })
      .eq("id", athlete.id);
    if (error) {
      setAthlete(previous);
      notify("Couldn't save preference.", "error");
    } else {
      notify(next ? "Turned on." : "Turned off.", "success");
    }
  }

  async function handlePurchase(tierId: string) {
    const tier = CREDIT_TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    const confirmed = window.confirm(
      `Buy ${tier.label}: ${tier.credits} credits for ${formatDollars(tier.priceCents)}?`,
    );
    if (!confirmed) return;
    setPurchaseLoadingTier(tierId);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        notify(data.error ?? "Couldn't start checkout.", "error");
        setPurchaseLoadingTier(null);
        return;
      }
      window.location.assign(data.url);
    } catch {
      notify("Couldn't start checkout.", "error");
      setPurchaseLoadingTier(null);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Use at least 6 characters.");
      return;
    }

    setPasswordSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordSuccess(true);
    setPasswordOpen(false);
    notify("Password updated.", "success");
  }

  function cancelPasswordChange() {
    setPasswordOpen(false);
    setPasswordError("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const gradYear = form.get("graduation_year") as string;

    const updates = {
      full_name: form.get("full_name") as string,
      sport: (form.get("sport") as string) || null,
      school: (form.get("school") as string) || null,
      graduation_year: gradYear ? parseInt(gradYear, 10) : null,
      phone: (form.get("phone") as string) || null,
      instagram_handle: (form.get("instagram_handle") as string) || null,
      shipping_address: (form.get("shipping_address") as string) || null,
    };

    const { data, error: updateError } = await supabase
      .from("athletes")
      .update(updates)
      .eq("id", athlete.id)
      .select()
      .single();

    if (updateError || !data) {
      setError(updateError?.message || "Couldn't save. Try again.");
      setSaving(false);
      return;
    }

    setAthlete(data as Athlete);
    setEditing(false);
    setSaving(false);
    notify("Profile updated.", "success");
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Settings</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Name</label>
            <input name="full_name" defaultValue={athlete.full_name} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Email</label>
            <p className="text-sm text-zinc-500">{athlete.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">School</label>
            <input name="school" defaultValue={athlete.school || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Sport</label>
            <input name="sport" defaultValue={athlete.sport || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Graduation Year</label>
            <input
              name="graduation_year"
              type="number"
              min={2024}
              max={2032}
              defaultValue={athlete.graduation_year || ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Phone</label>
            <input name="phone" type="tel" defaultValue={athlete.phone || ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Instagram handle
            </label>
            <input
              name="instagram_handle"
              defaultValue={athlete.instagram_handle || ""}
              placeholder="@yourhandle"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-zinc-400">Used by brand partners in the Vault.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
              Shipping address
            </label>
            <textarea
              name="shipping_address"
              defaultValue={athlete.shipping_address || ""}
              rows={3}
              placeholder="Street, city, state, ZIP"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-zinc-400">Where brands send product offers.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
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
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Name</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">{athlete.full_name || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Email</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">{athlete.email}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">School</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">{athlete.school || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Sport</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">{athlete.sport || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Graduation Year</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">{athlete.graduation_year || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Phone</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">{athlete.phone || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Instagram</p>
            <p className="text-sm text-acl-black dark:text-zinc-100">
              {athlete.instagram_handle || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Shipping address</p>
            <p className="text-sm text-acl-black dark:text-zinc-100 whitespace-pre-wrap">
              {athlete.shipping_address || "Not set"}
            </p>
          </div>
        </div>
      )}

      <div id="credits" className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Credits</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each message to your AI Assistant costs 1 credit. Auto-analyzing an
          uploaded contract costs 3 credits.
        </p>
        <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
          <p className="text-2xl font-bold text-acl-black dark:text-zinc-100">{athlete.credits}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">credits available</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CREDIT_TIERS.map((tier) => (
            <div
              key={tier.id}
              className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4"
            >
              <p className="text-xs uppercase tracking-wider text-zinc-500">{tier.label}</p>
              <p className="mt-2 text-2xl font-bold text-acl-black dark:text-zinc-100">{tier.credits}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">credits</p>
              <p className="mt-3 text-lg font-semibold text-acl-black dark:text-zinc-100">
                {formatDollars(tier.priceCents)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{tier.tagline}</p>
              <button
                type="button"
                onClick={() => handlePurchase(tier.id)}
                disabled={purchaseLoadingTier !== null}
                className="mt-4 w-full rounded-lg bg-acl-orange py-2 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                {purchaseLoadingTier === tier.id
                  ? "Redirecting..."
                  : `Buy ${tier.label}`}
              </button>
            </div>
          ))}
        </div>
        {athlete.credits === 0 && (
          <p className="mt-2 text-xs text-red-600">
            You&apos;re out of credits. Pick a pack above to keep chatting.
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Appearance</h2>
        <p className="mt-1 text-xs text-zinc-500">Light, dark, or follow your system.</p>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Notifications</h2>
        <p className="mt-1 text-xs text-zinc-500">Which emails you want from us.</p>
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 cursor-pointer hover:border-zinc-300 transition-colors">
            <input
              type="checkbox"
              checked={athlete.email_follow_up_reminders}
              onChange={(e) => toggleEmailPref("email_follow_up_reminders", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-acl-orange"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-acl-black dark:text-zinc-100">Daily follow-up reminders</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Morning email listing any brands due for follow-up today. Sent when you have any.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 cursor-pointer hover:border-zinc-300 transition-colors">
            <input
              type="checkbox"
              checked={athlete.email_weekly_digest}
              onChange={(e) => toggleEmailPref("email_weekly_digest", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-acl-orange"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-acl-black dark:text-zinc-100">Monday weekly digest</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                One email every Monday morning with your follow-ups, deliverables, and scheduled
                content for the week.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 cursor-pointer hover:border-zinc-300 transition-colors">
            <input
              type="checkbox"
              checked={athlete.email_brand_drops}
              onChange={(e) => toggleEmailPref("email_brand_drops", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-acl-orange"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-acl-black dark:text-zinc-100">Brand Vault drops</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                A short email when a new brand is added to your Brand Vault.
              </p>
            </div>
          </label>
          <PushToggle />
        </div>
      </div>

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Password</h2>
        {passwordOpen ? (
          <form onSubmit={handlePasswordChange} className="mt-3 space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="New password"
              className={inputClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm new password"
              className={inputClass}
            />
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-lg bg-acl-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                {passwordSaving ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                onClick={cancelPasswordChange}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setPasswordOpen(true); setPasswordSuccess(false); }}
              className="text-sm text-acl-blue hover:underline"
            >
              Change password
            </button>
            {passwordSuccess && (
              <span className="text-xs text-green-600">Updated.</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Community</h2>
        <p className="mt-1 text-xs text-zinc-500">
          The rest of ACL lives in Skool — Q&amp;As, playbooks, and other athletes
          building their NIL businesses.
        </p>
        <a
          href={SKOOL_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Open ACL on Skool ↗
        </a>
      </div>

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">Feedback</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Found a bug or want a feature? Send it straight to us.
        </p>
        <div className="mt-3 -ml-3">
          <FeedbackButton />
        </div>
      </div>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
