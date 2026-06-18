import { createClient } from "@supabase/supabase-js";

// Public endpoint (no auth required) — verifies an invite code during signup.
// Uses the service-role key because the anon RLS on invite_codes only allows
// SELECT of unclaimed/unexpired rows; the service-role bypass lets us return
// the team/org context attached to the code so the signup UI can show
// "Joining Team X at University Y".
//
// We deliberately return only the minimum (valid + team/org names) so a
// scraper of this endpoint can't enumerate code metadata beyond what the
// user holding the code would already see.
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return Response.json({ valid: false });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE env vars:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
      });
      return Response.json({ valid: false, error: "Server configuration error" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("invite_codes")
      .select(
        `
        id,
        expires_at,
        team_id,
        teams ( id, name, sport, organizations ( id, name ) )
      `,
      )
      .eq("code", code.trim().toUpperCase())
      .is("used_by", null)
      .maybeSingle();

    const isExpired = data?.expires_at && new Date(data.expires_at) < new Date();

    if (error) {
      console.error("Invite code query error:", error);
      return Response.json({ valid: false });
    }

    if (!data || isExpired) {
      return Response.json({ valid: false });
    }

    // Flatten team/org names if present. Supabase joins return nested objects
    // or null when the FK is null.
    type JoinedTeam = {
      id: string;
      name: string;
      sport: string | null;
      organizations: { id: string; name: string } | null;
    } | null;
    const team = data.teams as JoinedTeam;

    return Response.json({
      valid: true,
      team: team
        ? {
            id: team.id,
            name: team.name,
            sport: team.sport,
            org: team.organizations
              ? { id: team.organizations.id, name: team.organizations.name }
              : null,
          }
        : null,
    });
  } catch (err) {
    console.error("Verify invite error:", err);
    return Response.json({ valid: false });
  }
}
