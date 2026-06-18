import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { ContractDetailClient } from "./contract-detail-client";
import type { Contract, Deliverable, ContractPayment } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title || "Contract" };
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, brands(id, business_name)")
    .eq("id", id)
    .eq("athlete_id", athlete.id)
    .single();

  if (!contract) {
    notFound();
  }

  const [{ data: deliverables }, { data: payments }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*")
      .eq("contract_id", id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("contract_payments")
      .select("*")
      .eq("contract_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  return (
    <ContractDetailClient
      contract={contract as Contract & { brands: { id: string; business_name: string } | null }}
      deliverables={(deliverables ?? []) as Deliverable[]}
      payments={(payments ?? []) as ContractPayment[]}
      athleteId={athlete.id}
    />
  );
}
