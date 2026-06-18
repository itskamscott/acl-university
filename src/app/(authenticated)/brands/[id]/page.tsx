import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { notFound } from "next/navigation";
import { BRAND_CATEGORIES, BRAND_STATUSES } from "@/lib/types";
import type { Brand, BrandActivity } from "@/lib/types";
import { BrandDetailClient } from "./brand-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("business_name")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.business_name || "Brand" };
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .eq("athlete_id", athlete.id)
    .single();

  if (!brand) {
    notFound();
  }

  const [{ data: activities }, { data: contracts }] = await Promise.all([
    supabase
      .from("brand_activities")
      .select("*")
      .eq("brand_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contracts")
      .select("id, title, status, total_value_cents, currency, signed_at")
      .eq("brand_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <BrandDetailClient
      brand={brand as Brand}
      activities={(activities || []) as BrandActivity[]}
      contracts={(contracts ?? []) as {
        id: string;
        title: string;
        status: string;
        total_value_cents: number | null;
        currency: string;
        signed_at: string | null;
      }[]}
      athleteId={athlete.id}
      categories={BRAND_CATEGORIES}
      statuses={BRAND_STATUSES}
    />
  );
}
