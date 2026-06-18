import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { BRAND_STATUSES } from "@/lib/types";
import type { Brand } from "@/lib/types";
import { PipelineClient } from "./pipeline-client";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  // Latest activity timestamp per brand — used to flag stalled pipeline entries.
  const { data: activities } = await supabase
    .from("brand_activities")
    .select("brand_id, created_at")
    .eq("athlete_id", athlete.id)
    .order("created_at", { ascending: false });

  const lastActivityByBrand: Record<string, string> = {};
  for (const row of activities ?? []) {
    const brandId = row.brand_id as string;
    if (!lastActivityByBrand[brandId]) {
      lastActivityByBrand[brandId] = row.created_at as string;
    }
  }

  return (
    <PipelineClient
      brands={(brands || []) as Brand[]}
      statuses={BRAND_STATUSES}
      athleteId={athlete.id}
      lastActivityByBrand={lastActivityByBrand}
    />
  );
}
