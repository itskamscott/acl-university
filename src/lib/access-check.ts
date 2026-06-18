// Spec §6 — every route that uses the service-role client (which bypasses
// RLS) must verify the caller's access in code before running analysis.
//
// These helpers return the access decision based on the caller's profile +
// the resource's tenancy. They load via the RLS-respecting cookie client so
// the access check is itself filtered by RLS — which means: even if a row
// pointer is forged, the lookup returns null and we deny.

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AccessDenied = { ok: false; status: 401 | 403 | 404; error: string };
export type AccessGranted<T> = { ok: true; user: User; profile: ProfileRow; resource: T };
type ProfileRow = {
  id: string;
  role: "acl_admin" | "university_admin" | "team_manager" | "athlete";
  org_id: string | null;
};

async function loadCaller(
  supabase: SupabaseClient,
): Promise<{ user: User; profile: ProfileRow } | AccessDenied> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, status: 401, error: "No profile" };
  return { user, profile: profile as ProfileRow };
}

// Resolve the athlete row for an athlete-role caller (lets us scope owned-
// resource checks without a separate query at the callsite).
async function athleteIdFor(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("athletes")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

interface ContractRow {
  id: string;
  athlete_id: string;
  org_id: string | null;
  team_id: string | null;
  contract_file_path: string | null;
  title: string | null;
  total_value_cents: number | null;
  signed_at: string | null;
  brand_id: string | null;
}

// Returns the contract IFF the caller is permitted to operate on it per
// spec §2's role + scope matrix (matches the contracts_select RLS but
// evaluated in JS so service-role routes don't accidentally widen access).
export async function assertContractAccess(
  supabase: SupabaseClient,
  contractId: string,
): Promise<AccessDenied | AccessGranted<ContractRow>> {
  const caller = await loadCaller(supabase);
  if ("ok" in caller && !caller.ok) return caller;
  const { user, profile } = caller as { user: User; profile: ProfileRow };

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, athlete_id, org_id, team_id, contract_file_path, title, total_value_cents, signed_at, brand_id",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { ok: false, status: 404, error: "Contract not found" };

  const row = contract as ContractRow;

  if (profile.role === "acl_admin") {
    return { ok: true, user, profile, resource: row };
  }
  if (profile.role === "university_admin") {
    if (row.org_id && row.org_id === profile.org_id) {
      return { ok: true, user, profile, resource: row };
    }
    return { ok: false, status: 403, error: "Not in your university" };
  }
  if (profile.role === "team_manager") {
    if (!row.team_id) return { ok: false, status: 403, error: "Not in your team" };
    const { data: assignments } = await supabase
      .from("team_assignments")
      .select("team_id")
      .eq("profile_id", profile.id)
      .eq("kind", "manager")
      .eq("team_id", row.team_id);
    if ((assignments ?? []).length > 0) {
      return { ok: true, user, profile, resource: row };
    }
    return { ok: false, status: 403, error: "Not in your team" };
  }
  // athlete: must own
  const athleteId = await athleteIdFor(supabase, user.id);
  if (athleteId && row.athlete_id === athleteId) {
    return { ok: true, user, profile, resource: row };
  }
  return { ok: false, status: 403, error: "Not your contract" };
}

// Team-level access (read/manage). Used by team-level AI features.
export async function assertTeamAccess(
  supabase: SupabaseClient,
  teamId: string,
): Promise<
  | AccessDenied
  | { ok: true; user: User; profile: ProfileRow; team: { id: string; name: string; sport: string | null; org_id: string } }
> {
  const caller = await loadCaller(supabase);
  if ("ok" in caller && !caller.ok) return caller;
  const { user, profile } = caller as { user: User; profile: ProfileRow };

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, sport, org_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, status: 404, error: "Team not found" };

  const shaped = team as { id: string; name: string; sport: string | null; org_id: string };

  if (profile.role === "acl_admin") {
    return { ok: true, user, profile, team: shaped };
  }
  if (profile.role === "university_admin") {
    if (shaped.org_id === profile.org_id) {
      return { ok: true, user, profile, team: shaped };
    }
    return { ok: false, status: 403, error: "Not in your university" };
  }
  if (profile.role === "team_manager") {
    const { data: assignments } = await supabase
      .from("team_assignments")
      .select("team_id")
      .eq("profile_id", profile.id)
      .eq("kind", "manager")
      .eq("team_id", shaped.id);
    if ((assignments ?? []).length > 0) {
      return { ok: true, user, profile, team: shaped };
    }
  }
  return { ok: false, status: 403, error: "Not your team" };
}
