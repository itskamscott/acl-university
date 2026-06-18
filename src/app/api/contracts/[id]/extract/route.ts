import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractContractStructure, EXTRACTION_CREDIT_COST } from "@/lib/contracts/extract";
import { findOrCreateBrand } from "@/lib/brands/resolver";
import { assertContractAccess } from "@/lib/access-check";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: contractId } = await params;
  const supabase = await createClient();

  // Spec §6 — verify the caller's access BEFORE switching to admin.
  // Helper enforces: acl_admin (any), uni_admin (own org), team_manager
  // (assigned teams), athlete (must own).
  const access = await assertContractAccess(supabase, contractId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { profile, resource: contract } = access;
  const ownerAthleteId = contract.athlete_id;

  if (!contract.contract_file_path) {
    return NextResponse.json(
      { error: "Attach a file first — there's nothing to analyze." },
      { status: 400 },
    );
  }

  // Credit consumption applies only when the caller IS the owning athlete.
  // Staff calls don't drain athlete credits.
  let availableCredits = Number.POSITIVE_INFINITY;
  if (profile.role === "athlete") {
    const { data: athleteRow } = await supabase
      .from("athletes")
      .select("credits")
      .eq("id", ownerAthleteId)
      .maybeSingle();
    availableCredits = athleteRow?.credits ?? 0;
    if (availableCredits < EXTRACTION_CREDIT_COST) {
      return NextResponse.json(
        {
          error: `Contract analysis costs ${EXTRACTION_CREDIT_COST} credits. You have ${availableCredits}. Grab more from Settings.`,
          code: "insufficient_credits",
        },
        { status: 402 },
      );
    }
  }

  const admin = createAdminClient();

  const extraction = await extractContractStructure({
    storage: admin,
    filePath: contract.contract_file_path,
  });

  if (!extraction.ok) {
    const status = extraction.skipped ? 400 : 500;
    return NextResponse.json({ error: extraction.error }, { status });
  }

  // Only charge credits when the extraction actually returned data AND the
  // caller is the athlete. Staff bypass.
  let consumed = 0;
  if (profile.role === "athlete") {
    for (let i = 0; i < EXTRACTION_CREDIT_COST; i++) {
      const { data: remaining } = await admin.rpc("consume_credit", {
        p_athlete_id: ownerAthleteId,
        p_reason: "contract_extraction",
      });
      if (remaining === null) break;
      consumed++;
    }
  }

  const data = extraction.data;

  // Insert deliverables (always pinned to the owning athlete, not the caller)
  const deliverableRows = data.deliverables
    .filter((d) => typeof d.description === "string" && d.description.trim().length > 0)
    .map((d, idx) => ({
      contract_id: contract.id,
      athlete_id: ownerAthleteId,
      description: d.description.trim(),
      due_date: d.due_date && /^\d{4}-\d{2}-\d{2}$/.test(d.due_date) ? d.due_date : null,
      order_index: idx,
    }));
  if (deliverableRows.length > 0) {
    const { error: deliverableError } = await admin.from("deliverables").insert(deliverableRows);
    if (deliverableError) {
      console.error("insert deliverables failed:", deliverableError);
    }
  }

  // Insert payments
  const paymentRows = data.payments
    .filter((p) => Number.isFinite(p.amount_cents) && p.amount_cents > 0)
    .map((p) => ({
      contract_id: contract.id,
      athlete_id: ownerAthleteId,
      amount_cents: Math.round(p.amount_cents),
      due_date: p.due_date && /^\d{4}-\d{2}-\d{2}$/.test(p.due_date) ? p.due_date : null,
      received_at: p.received ? new Date().toISOString().split("T")[0] : null,
      notes: p.notes && p.notes.trim() ? p.notes.trim() : null,
    }));
  if (paymentRows.length > 0) {
    const { error: paymentError } = await admin.from("contract_payments").insert(paymentRows);
    if (paymentError) {
      console.error("insert payments failed:", paymentError);
    }
  }

  // Auto-link / auto-create brand if the model identified one and the
  // contract isn't already linked. Brand belongs to the owning athlete.
  let brandLinkedName: string | null = null;
  let brandCreated = false;
  if (!contract.brand_id && data.brand_name) {
    const resolution = await findOrCreateBrand(admin, ownerAthleteId, data.brand_name, {
      statusOnCreate: contract.signed_at ? "deal_closed" : "negotiating",
    });
    if (resolution.ok) {
      brandLinkedName = resolution.brand.business_name;
      brandCreated = resolution.brand.created;
      await admin
        .from("contracts")
        .update({ brand_id: resolution.brand.id })
        .eq("id", contract.id);
    }
  }

  // Fill in contract fields we can without overwriting existing data.
  const contractUpdates: Record<string, unknown> = {};
  if (contract.total_value_cents === null && typeof data.total_value_cents === "number") {
    contractUpdates.total_value_cents = Math.round(data.total_value_cents);
  }
  if (!contract.signed_at && data.signed_date && /^\d{4}-\d{2}-\d{2}$/.test(data.signed_date)) {
    contractUpdates.signed_at = data.signed_date;
    contractUpdates.status = "active";
  }
  if ((contract.title?.trim().toLowerCase() ?? "") === "untitled" && data.suggested_title) {
    contractUpdates.title = data.suggested_title;
  }
  if (Object.keys(contractUpdates).length > 0) {
    await admin.from("contracts").update(contractUpdates).eq("id", contract.id);
  }

  return NextResponse.json({
    ok: true,
    credits_used: consumed,
    deliverables_added: deliverableRows.length,
    payments_added: paymentRows.length,
    brand_linked: brandLinkedName,
    brand_created: brandCreated,
    summary: data.summary,
  });
}
