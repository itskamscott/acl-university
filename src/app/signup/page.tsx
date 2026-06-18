"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Clapperboard, FileText, Gift, MessageCircle } from "lucide-react";
import { sendWelcomeEmail } from "./welcome-action";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

type Step = "invite" | "account" | "athletic" | "vault" | "welcome";
const STEP_ORDER: Step[] = ["invite", "account", "athletic", "vault", "welcome"];

function StepIndicator({ step }: { step: Step }) {
  const current = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {STEP_ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? "w-8 bg-acl-orange"
              : i < current
              ? "w-4 bg-acl-orange/60"
              : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

type InviteTeam = {
  id: string;
  name: string;
  sport: string | null;
  org: { id: string; name: string } | null;
} | null;

function SignupForm() {
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code")?.toUpperCase() ?? "";
  const [step, setStep] = useState<Step>("invite");
  const [inviteCode, setInviteCode] = useState(prefilledCode);
  const [inviteTeam, setInviteTeam] = useState<InviteTeam>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sport, setSport] = useState("");
  const [school, setSchool] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  function clearError() {
    if (error) setError("");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);

    const res = await fetch("/api/verify-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode }),
    });
    const { valid, team } = await res.json();

    if (!valid) {
      setError("That code didn't check out. Double-check the email you got.");
      setLoading(false);
      return;
    }

    // Team-linked invites pre-bind the athlete to a team via DB trigger
    // (migration 024) when the code is claimed. Surface the context here
    // and pre-fill the school field with the org name.
    if (team) {
      setInviteTeam(team as InviteTeam);
      if (team.org?.name) setSchool(team.org.name);
      if (team.sport) setSport(team.sport);
    }

    setLoading(false);
    setStep("account");
  }

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          invite_code: inviteCode.trim().toUpperCase(),
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (!authData.user) {
      setError("Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    // Create the athlete row with the minimum fields. We'll fill in the
    // rest across the remaining steps via UPDATE on the same row.
    const { data: inserted, error: profileError } = await supabase
      .from("athletes")
      .insert({
        auth_user_id: authData.user.id,
        full_name: fullName,
        email,
      })
      .select("id")
      .single();

    if (profileError || !inserted) {
      setError("Account created but profile setup failed. Contact support.");
      setLoading(false);
      return;
    }
    setAthleteId(inserted.id as string);

    // Mark the invite code as used now that the athlete exists.
    await supabase
      .from("invite_codes")
      .update({ used_by: inserted.id })
      .eq("code", inviteCode.trim().toUpperCase());

    // Fire-and-forget welcome email at account creation; profile is fine to
    // complete after.
    void sendWelcomeEmail(email, fullName);

    setLoading(false);
    setStep("athletic");
  }

  async function handleAthletic(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (!athleteId) {
      setError("Lost your session — refresh and sign in.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase
      .from("athletes")
      .update({
        sport: sport.trim() || null,
        school: school.trim() || null,
        graduation_year: graduationYear ? parseInt(graduationYear, 10) : null,
      })
      .eq("id", athleteId);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStep("vault");
  }

  async function handleVault(skip: boolean) {
    clearError();
    if (!athleteId) {
      setError("Lost your session — refresh and sign in.");
      return;
    }
    if (skip) {
      setStep("welcome");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase
      .from("athletes")
      .update({
        instagram_handle: instagramHandle.trim() || null,
        shipping_address: shippingAddress.trim() || null,
      })
      .eq("id", athleteId);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStep("welcome");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-zinc-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image src="/logo.png" alt="ACL+" width={64} height={64} priority />
          <h1 className="mt-3 text-xl font-bold text-acl-black dark:text-zinc-100">
            {step === "invite" && "Join ACL+"}
            {step === "account" && "Create your account"}
            {step === "athletic" && "Tell us about you"}
            {step === "vault" && "Unlock Brand Vault"}
            {step === "welcome" && `You're in, ${fullName.split(" ")[0] || "athlete"}`}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 text-center">
            {step === "invite" && "Enter the invite code we emailed you."}
            {step === "account" && "Start with the basics. We'll fill out your profile next."}
            {step === "athletic" && "Helps the AI Assistant tailor outreach and recommendations."}
            {step === "vault" && "Brand partners need to verify and ship to you. Add now or skip."}
            {step === "welcome" && "Here's what's inside ACL+ — open whatever feels useful."}
          </p>
        </div>

        {step !== "invite" && <StepIndicator step={step} />}

        {step !== "invite" && inviteTeam && (
          <div className="mb-4 rounded-lg border border-acl-blue/30 bg-acl-blue/5 p-3 text-xs text-zinc-700 dark:text-zinc-200">
            Joining <span className="font-semibold">{inviteTeam.name}</span>
            {inviteTeam.org?.name ? (
              <> at <span className="font-semibold">{inviteTeam.org.name}</span></>
            ) : null}
            .
          </div>
        )}

        {step === "invite" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                Invite code
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-center tracking-wider uppercase focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue"
                placeholder="ACL-XXXX-XXXX"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-acl-orange py-2.5 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        )}

        {step === "account" && (
          <form onSubmit={handleAccount} className="space-y-4">
            <Field label="Full name">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputCls}
                placeholder="First and last"
              />
            </Field>
            <Field label="Email" hint="We'll send invoices, reminders, and brand drops here.">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
                placeholder="you@school.edu"
              />
            </Field>
            <Field label="Password" hint="At least 6 characters. Use something only you'd guess.">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputCls}
                placeholder="••••••••"
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-acl-orange py-2.5 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {step === "athletic" && (
          <form onSubmit={handleAthletic} className="space-y-4">
            <Field label="Sport" hint="e.g. Football, Basketball, Track.">
              <input
                type="text"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className={inputCls}
                placeholder="What you compete in"
              />
            </Field>
            <Field label="School">
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className={inputCls}
                placeholder="Your university"
              />
            </Field>
            <Field label="Graduation year">
              <input
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                min={2024}
                max={2032}
                className={inputCls}
                placeholder="e.g. 2027"
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("vault")}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-acl-orange py-2.5 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Continue"}
              </button>
            </div>
          </form>
        )}

        {step === "vault" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVault(false);
            }}
            className="space-y-4"
          >
            <div className="rounded-lg border border-acl-orange/30 bg-acl-orange/5 p-3 text-xs text-zinc-700 dark:text-zinc-300">
              <p>
                <span className="font-semibold text-acl-black dark:text-zinc-100">Brand Vault</span> is
                where ACL brand partners drop free discount codes for our athletes. To verify and
                ship, brands need your IG handle and shipping address.
              </p>
            </div>
            <Field label="Instagram handle" hint="No @ needed.">
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                className={inputCls}
                placeholder="yourhandle"
              />
            </Field>
            <Field label="Shipping address" hint="Street, city, state, ZIP. Used only for brand fulfillment.">
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="123 Main St, Manhattan KS 66502"
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleVault(true)}
                disabled={loading}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-acl-orange py-2.5 text-sm font-medium text-white hover:bg-acl-orange/90 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save & continue"}
              </button>
            </div>
          </form>
        )}

        {step === "welcome" && (
          <div className="space-y-3">
            <FeatureCard
              icon={Building2}
              title="Brand CRM"
              body="Track every local business you want a deal with."
            />
            <FeatureCard
              icon={MessageCircle}
              title="AI Assistant"
              body="Snap a contract or business card; it logs the details."
            />
            <FeatureCard
              icon={FileText}
              title="Contracts"
              body="Deliverables, payments, and signed agreements in one place."
            />
            <FeatureCard
              icon={Clapperboard}
              title="Content calendar"
              body="Ideas, drafts, and scheduled posts across every platform."
            />
            <FeatureCard
              icon={Gift}
              title="Brand Vault"
              body="Free discount codes from ACL partners. 3 reveals per month."
            />
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-acl-orange py-2.5 text-sm font-semibold text-white hover:bg-acl-orange/90"
            >
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === "invite" && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-acl-blue hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Building2;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
      <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-acl-orange/10">
        <Icon className="h-4 w-4 text-acl-orange" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-acl-black dark:text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{body}</p>
      </div>
    </div>
  );
}
