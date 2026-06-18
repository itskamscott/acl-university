"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AthleteTier } from "@/lib/types";

type ActionResult = { ok: true } | { ok: false; error: string };

// Tier transitions allowed via this UI:
//   member <-> insider <-> lab_partner
// Founder is bootstrap-only (set via the existing is_admin flag + the
// migration backfill); promoting/demoting founders happens at the DB
// level so the UI can never accidentally lock everyone out.
export async function setAthleteTier(
  athleteId: string,
  tier: AthleteTier,
): Promise<ActionResult> {
  await requireAdmin();
  if (tier === "founder") {
    return { ok: false, error: "Founders are managed via is_admin, not here." };
  }

  const admin = createAdminClient();
  const { data: athlete } = await admin
    .from("athletes")
    .select("id, tier")
    .eq("id", athleteId)
    .single();
  if (!athlete) return { ok: false, error: "Athlete not found." };
  if (athlete.tier === "founder") {
    return { ok: false, error: "Founders cannot be demoted via this UI." };
  }
  if (athlete.tier === tier) return { ok: true };

  // Demoting an LP who still leads an active pod would orphan the pod's
  // Insiders. Block until the pod is archived or the LP is replaced.
  if (athlete.tier === "lab_partner") {
    const { data: ledPods } = await admin
      .from("pods")
      .select("name")
      .eq("lab_partner_id", athleteId)
      .is("archived_at", null);
    if (ledPods && ledPods.length > 0) {
      const names = ledPods.map((p) => p.name).join(", ");
      return {
        ok: false,
        error: `Reassign or archive their pod first: ${names}.`,
      };
    }
  }

  // Leaving Insider tier means leaving the active pod (if any). Soft-leave
  // by setting left_at so the membership row is preserved for review history.
  if (athlete.tier === "insider") {
    await admin
      .from("pod_memberships")
      .update({ left_at: new Date().toISOString() })
      .eq("athlete_id", athleteId)
      .is("left_at", null);
  }

  const { error } = await admin
    .from("athletes")
    .update({ tier })
    .eq("id", athleteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/lab-partners");
  return { ok: true };
}

export async function createPod(input: {
  name: string;
  labPartnerId: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Pod name is required." };

  const admin = createAdminClient();
  const { data: lp } = await admin
    .from("athletes")
    .select("tier")
    .eq("id", input.labPartnerId)
    .single();
  if (!lp || lp.tier !== "lab_partner") {
    return { ok: false, error: "Selected athlete is not a Lab Partner." };
  }

  const { error } = await admin.from("pods").insert({
    name,
    lab_partner_id: input.labPartnerId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/lab-partners");
  return { ok: true };
}

export async function renamePod(
  podId: string,
  name: string,
): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Pod name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("pods")
    .update({ name: trimmed })
    .eq("id", podId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/lab-partners");
  return { ok: true };
}

export async function archivePod(podId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  // Soft-leave every active member first so their leave history is
  // attributed to "pod archived" rather than left dangling.
  await admin
    .from("pod_memberships")
    .update({ left_at: new Date().toISOString() })
    .eq("pod_id", podId)
    .is("left_at", null);

  const { error } = await admin
    .from("pods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", podId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/lab-partners");
  return { ok: true };
}

export async function addInsiderToPod(input: {
  podId: string;
  athleteId: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: athlete } = await admin
    .from("athletes")
    .select("tier")
    .eq("id", input.athleteId)
    .single();
  if (!athlete) return { ok: false, error: "Athlete not found." };
  if (athlete.tier !== "insider") {
    return { ok: false, error: "Only Insiders can join a pod." };
  }

  // The partial unique index would also catch this, but we raise a friendlier
  // message than a Postgres constraint violation.
  const { data: existing } = await admin
    .from("pod_memberships")
    .select("pod_id")
    .eq("athlete_id", input.athleteId)
    .is("left_at", null)
    .maybeSingle();
  if (existing) {
    if (existing.pod_id === input.podId) {
      return { ok: false, error: "Already in this pod." };
    }
    return {
      ok: false,
      error: "Already in another active pod. Remove them there first.",
    };
  }

  const { error } = await admin.from("pod_memberships").insert({
    pod_id: input.podId,
    athlete_id: input.athleteId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/lab-partners");
  return { ok: true };
}

export async function removeInsiderFromPod(
  membershipId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("pod_memberships")
    .update({ left_at: new Date().toISOString() })
    .eq("id", membershipId)
    .is("left_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/lab-partners");
  return { ok: true };
}
