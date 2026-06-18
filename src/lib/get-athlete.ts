import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Athlete, AthleteTeamContext } from "@/lib/types";

export const getAthleteOrRedirect = cache(
  async (): Promise<{ athlete: Athlete; userId: string }> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: athlete } = await supabase
      .from("athletes")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    if (!athlete) {
      redirect("/login");
    }

    return { athlete: athlete as Athlete, userId: user.id };
  },
);

export const requireAdmin = cache(async (): Promise<Athlete> => {
  const { athlete } = await getAthleteOrRedirect();
  if (!athlete.is_admin) {
    redirect("/dashboard");
  }
  return athlete;
});

// Phase 2 — resolve the athlete's team and org. Returns nulls if the
// athlete isn't yet bound to a team (e.g. signed up before universities
// were set up). Reads via RLS-respecting client; team/org policies already
// allow the athlete to read their own team and org per migration 022/023.
export const getAthleteTeamContext = cache(
  async (): Promise<AthleteTeamContext> => {
    const { athlete } = await getAthleteOrRedirect();
    if (!athlete.team_id) {
      return { team: null, org: null };
    }
    const supabase = await createClient();
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, sport, organizations ( id, name )")
      .eq("id", athlete.team_id)
      .maybeSingle();
    if (!team) {
      return { team: null, org: null };
    }
    type JoinedOrg = { id: string; name: string } | null;
    return {
      team: { id: team.id, name: team.name, sport: team.sport },
      org: (team.organizations as JoinedOrg) ?? null,
    };
  },
);
