"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAclAdmin(): Promise<ActionResult> {
  const profile = await getStaffProfileOrRedirect();
  if (profile.role !== "acl_admin") {
    return { ok: false, error: "ACL admin role required." };
  }
  return { ok: true };
}

// ---------- Organizations ----------

export async function setOrgDefaultPercentage(
  orgId: string,
  percentage: number,
): Promise<ActionResult> {
  const gate = await requireAclAdmin();
  if (!gate.ok) return gate;
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return { ok: false, error: "Percentage must be between 0 and 100." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ default_acl_percentage: percentage })
    .eq("id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orgs");
  return { ok: true };
}

export async function updateOrgName(orgId: string, name: string): Promise<ActionResult> {
  const gate = await requireAclAdmin();
  if (!gate.ok) return gate;
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Name cannot be empty." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: trimmed })
    .eq("id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orgs");
  return { ok: true };
}

export async function createOrganization(name: string): Promise<ActionResult> {
  const gate = await requireAclAdmin();
  if (!gate.ok) return gate;
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Name cannot be empty." };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").insert({ name: trimmed });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orgs");
  return { ok: true };
}

// ---------- Payouts ----------

const PAYOUT_FORWARD = {
  pending: "invoiced",
  invoiced: "received",
  received: "paid_out",
} as const;
type PayoutStatus = "pending" | "invoiced" | "received" | "paid_out";

export async function advancePayoutStatus(
  payoutId: string,
  to: PayoutStatus,
): Promise<ActionResult> {
  const gate = await requireAclAdmin();
  if (!gate.ok) return gate;
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("payouts")
    .select("status")
    .eq("id", payoutId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Payout not found." };
  const from = current.status as PayoutStatus;
  const expected = PAYOUT_FORWARD[from as keyof typeof PAYOUT_FORWARD];
  if (expected !== to) {
    return {
      ok: false,
      error: `Cannot move payout from ${from} to ${to}. Allowed: ${from} → ${expected ?? "(terminal)"}.`,
    };
  }
  const updates: Record<string, unknown> = { status: to };
  if (to === "paid_out") updates.paid_at = new Date().toISOString();
  const { error } = await supabase.from("payouts").update(updates).eq("id", payoutId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/payouts");
  return { ok: true };
}
