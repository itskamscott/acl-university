import { redirect } from "next/navigation";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";
import { createClient } from "@/lib/supabase/server";
import { OrgsClient } from "./orgs-client";

export default async function OrgsPage() {
  const profile = await getStaffProfileOrRedirect();
  if (profile.role !== "acl_admin") redirect("/teams");

  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, default_acl_percentage, status, created_at")
    .order("name", { ascending: true });

  // Per-org team and athlete counts (RLS-unfiltered for ACL admin).
  const { data: teamRows } = await supabase.from("teams").select("org_id");
  const teamCountByOrg = new Map<string, number>();
  for (const t of teamRows ?? []) {
    if (t.org_id) teamCountByOrg.set(t.org_id, (teamCountByOrg.get(t.org_id) ?? 0) + 1);
  }
  const { data: athleteRows } = await supabase.from("athletes").select("org_id");
  const athleteCountByOrg = new Map<string, number>();
  for (const a of athleteRows ?? []) {
    if (a.org_id) athleteCountByOrg.set(a.org_id, (athleteCountByOrg.get(a.org_id) ?? 0) + 1);
  }

  type Row = {
    id: string;
    name: string;
    default_acl_percentage: number;
    status: string;
    created_at: string;
  };
  const rows = (orgs ?? []) as Row[];
  const enriched = rows.map((o) => ({
    ...o,
    team_count: teamCountByOrg.get(o.id) ?? 0,
    athlete_count: athleteCountByOrg.get(o.id) ?? 0,
  }));

  return <OrgsClient orgs={enriched} />;
}
