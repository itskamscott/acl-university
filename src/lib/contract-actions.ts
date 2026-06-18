"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";

// Spec §4: writes get tighter than reads. acl_admin owns the gated
// transitions; uni_admin/team_manager can advance the routing inside the
// "non-gated" range. Athletes don't move acl_status.
const STAGES = [
  "proposed",
  "agreement_attached",
  "acl_review",
  "active",
  "deliverables",
  "paid",
  "cancelled",
] as const;
type Stage = (typeof STAGES)[number];

// Per spec §4 — acl_admin can write payouts and change deal status to/from
// acl_review, paid. Everyone else is restricted to the in-scope transitions.
const ACL_ADMIN_ONLY_TRANSITIONS: Array<[Stage, Stage]> = [
  ["agreement_attached", "acl_review"],
  ["acl_review", "active"],
  ["deliverables", "paid"],
  ["paid", "acl_review"], // unwind
  ["paid", "deliverables"], // unwind
];

function isAclAdminGated(from: Stage, to: Stage): boolean {
  return ACL_ADMIN_ONLY_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function advanceContractAclStatus(
  contractId: string,
  toStatus: Stage,
): Promise<ActionResult> {
  const profile = await getStaffProfileOrRedirect();
  const supabase = await createClient();

  const { data: contract, error: loadErr } = await supabase
    .from("contracts")
    .select("id, acl_status, gross_amount, acl_percentage, org_id, team_id")
    .eq("id", contractId)
    .maybeSingle();
  if (loadErr || !contract) return { ok: false, error: "Contract not found." };

  const from = (contract.acl_status ?? "proposed") as Stage;
  if (!STAGES.includes(toStatus)) {
    return { ok: false, error: `Unknown status: ${toStatus}` };
  }
  if (from === toStatus) return { ok: true };

  if (isAclAdminGated(from, toStatus) && profile.role !== "acl_admin") {
    return {
      ok: false,
      error: `${from} → ${toStatus} is gated to ACL admins.`,
    };
  }

  // Block paid without amount — same guard the trigger enforces, but
  // surface a friendlier message.
  if (toStatus === "paid" && contract.gross_amount === null) {
    return {
      ok: false,
      error: "Set gross_amount before marking paid.",
    };
  }

  const { error } = await supabase
    .from("contracts")
    .update({ acl_status: toStatus })
    .eq("id", contractId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/deals/${contractId}`);
  revalidatePath("/payouts");
  if (contract.team_id) revalidatePath(`/teams/${contract.team_id}`);

  return { ok: true };
}

export async function setContractAclPercentage(
  contractId: string,
  percentage: number,
): Promise<ActionResult> {
  const profile = await getStaffProfileOrRedirect();
  // Per spec §4 — percentage is configured by ACL (org default) but per-deal
  // overrides are an ACL admin action. Uni-admin can ASK for an override
  // through a workflow that doesn't exist yet; for now lock it down.
  if (profile.role !== "acl_admin") {
    return { ok: false, error: "Only ACL admins can set per-deal percentage." };
  }
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return { ok: false, error: "Percentage must be between 0 and 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ acl_percentage: percentage })
    .eq("id", contractId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/deals/${contractId}`);
  return { ok: true };
}

export async function setContractGrossAmount(
  contractId: string,
  grossAmount: number,
): Promise<ActionResult> {
  await getStaffProfileOrRedirect(); // any staff role
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    return { ok: false, error: "Gross amount must be a non-negative number." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ gross_amount: grossAmount })
    .eq("id", contractId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/deals/${contractId}`);
  return { ok: true };
}
