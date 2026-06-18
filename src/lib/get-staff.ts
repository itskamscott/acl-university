import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "acl_admin" | "university_admin" | "team_manager";

export interface StaffProfile {
  id: string;
  role: StaffRole;
  org_id: string | null;
  full_name: string | null;
}

// Auth + role check for the (staff) route group. Redirects athletes
// (or non-authenticated) — they belong in the (authenticated) athlete
// surface, not here.
export const getStaffProfileOrRedirect = cache(
  async (): Promise<StaffProfile> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, org_id, full_name")
      .eq("id", user.id)
      .single();

    if (!profile) redirect("/login");
    if (profile.role === "athlete") redirect("/dashboard");

    return profile as StaffProfile;
  },
);

// Resolve the staff member's visible scope:
//   * acl_admin     → every team in every org
//   * university_admin → all teams in their org
//   * team_manager  → only the teams they're assigned to manage
// RLS would already filter these at the DB level; we still query
// the same way so the route gets a clean list whatever the role.
export interface StaffScopeTeam {
  id: string;
  name: string;
  sport: string | null;
  org: { id: string; name: string } | null;
}

export const getStaffTeams = cache(async (): Promise<StaffScopeTeam[]> => {
  const profile = await getStaffProfileOrRedirect();
  const supabase = await createClient();

  if (profile.role === "team_manager") {
    // RLS-aware: pull team_assignments first (filtered by RLS), then teams.
    const { data: assignments } = await supabase
      .from("team_assignments")
      .select("team_id")
      .eq("profile_id", profile.id)
      .eq("kind", "manager");
    const teamIds = (assignments ?? []).map((a) => a.team_id);
    if (teamIds.length === 0) return [];
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, sport, organizations ( id, name )")
      .in("id", teamIds)
      .order("name", { ascending: true });
    return shapeTeams(teams);
  }

  // acl_admin + university_admin — RLS scopes teams to their visible set.
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, sport, organizations ( id, name )")
    .order("name", { ascending: true });
  return shapeTeams(teams);
});

type RawTeamRow = {
  id: string;
  name: string;
  sport: string | null;
  organizations: { id: string; name: string } | null;
} | null;

function shapeTeams(rows: unknown): StaffScopeTeam[] {
  const list = (rows ?? []) as RawTeamRow[];
  return list.filter((r): r is NonNullable<RawTeamRow> => r !== null).map((r) => ({
    id: r.id,
    name: r.name,
    sport: r.sport,
    org: r.organizations,
  }));
}
