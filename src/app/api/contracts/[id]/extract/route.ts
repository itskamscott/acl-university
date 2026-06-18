import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractContractStructure, EXTRACTION_CREDIT_COST } from "@/lib/contracts/extract";
import { findOrCreateBrand } from "@/lib/brands/resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: contractId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, credits")
    .eq("auth_user_id", user.id)
    .single();
  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, athlete_id, brand_id, contract_file_path, title, total_value_cents, signed_at")
    .eq("id", contractId)
    .eq("athlete_id", athlete.id)
    .single();
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (!contract.contract_file_path) {
    return NextResponse.json(
      { error: "Attach a file first — there's nothing to analyze." },
      { status: 400 },
    );
  }

  if (athlete.credits < EXTRACTION_CREDIT_COST) {
    return NextResponse.json(
      {
        error: `Contract analysis costs ${EXTRACTION_CREDIT_COST} credits. You have ${athlete.credits}. Grab more from Settings.`,
        code: "insufficient_credits",
      },
      { status: 402 },
    );
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

  // Only charge credits when the extraction actually returned data.
  let consumed = 0;
  for (let i = 0; i < EXTRACTION_CREDIT_COST; i++) {
    const { data: remaining } = await admin.rpc("consume_credit", {
      p_athlete_id: athlete.id,
      p_reason: "contract_extraction",
    });
    if (remaining === null) break;
    consumed++;
  }

  const data = extraction.data;

  // Insert deliverables
  const deliverableRows = data.deliverables
    .filter((d) => typeof d.description === "string" && d.description.trim().length > 0)
    .map((d, idx) => ({
      contract_id: contract.id,
      athlete_id: athlete.id,
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
      athlete_id: athlete.id,
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
  // contract isn't already linked.
  let brandLinkedName: string | null = null;
  let brandCreated = false;
  if (!contract.brand_id && data.brand_name) {
    const resolution = await findOrCreateBrand(admin, athlete.id, data.brand_name, {
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

  // Update contract fields we can fill in (don't overwrite existing data).
  const contractUpdates: Record<string, unknown> = {};
  if (contract.total_value_cents === null && typeof data.total_value_cents === "number") {
    contractUpdates.total_value_cents = Math.round(data.total_value_cents);
  }
  if (!contract.signed_at && data.signed_date && /^\d{4}-\d{2}-\d{2}$/.test(data.signed_date)) {
    contractUpdates.signed_at = data.signed_date;
    contractUpdates.status = "active";
  }
  if (contract.title.trim().toLowerCase() === "untitled" && data.suggested_title) {
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
