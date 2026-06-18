import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { CONTENT_STATUSES } from "@/lib/types";
import type { ContentPost } from "@/lib/types";
import { ContentPipelineClient } from "./content-pipeline-client";

export const metadata = { title: "Content Pipeline" };

export default async function ContentPipelinePage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("content_posts")
    .select("*")
    .eq("athlete_id", athlete.id)
    .order("planned_for", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  return (
    <ContentPipelineClient
      posts={(posts ?? []) as ContentPost[]}
      statuses={CONTENT_STATUSES}
    />
  );
}
