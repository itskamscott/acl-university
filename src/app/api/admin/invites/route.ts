import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Generate a 9-char, ambiguity-safe code like ACL-K7P2-3RQM.
// Drops I, O, 1, 0 from the charset.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateInviteCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CHARS[bytes[i] % CHARS.length];
  return `ACL-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

// Creates a (optionally team-linked) invite code.
// Auth: caller must have profile.role in ('acl_admin','university_admin').
// Scope is enforced by RLS (migration 025) — uni-admins can only create
// codes for teams in their org.
//
// Body:
//   team_id?      uuid   — bind the code to a team; null means unscoped
//   invited_email? string — optional, for sending the invite email
//   expires_at?   ISO ts — optional expiry
//
// Returns: { code, team_id, invited_email, expires_at }
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Section 6 pattern: identity + access check via RLS client BEFORE any
  // mutation. We don't use the service-role client here at all — RLS
  // enforces who can insert which scopes.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role;
  if (role !== "acl_admin" && role !== "university_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { team_id?: string | null; invited_email?: string; expires_at?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const teamId = typeof body.team_id === "string" && body.team_id.length > 0 ? body.team_id : null;
  const invitedEmail =
    typeof body.invited_email === "string" && body.invited_email.includes("@")
      ? body.invited_email.trim().toLowerCase()
      : null;
  const expiresAt =
    typeof body.expires_at === "string" && !Number.isNaN(Date.parse(body.expires_at))
      ? new Date(body.expires_at).toISOString()
      : null;

  // Retry on the slim chance of a UNIQUE collision on `code`.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        team_id: teamId,
        invited_email: invitedEmail,
        expires_at: expiresAt,
      })
      .select("id, code, team_id, invited_email, expires_at")
      .single();

    if (!error && data) {
      return NextResponse.json(data, { status: 201 });
    }
    if (error?.code !== "23505") {
      // Not a uniqueness conflict — surface it
      console.error("create invite failed:", error);
      return NextResponse.json(
        { error: error?.message ?? "Failed to create invite" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique code after several attempts" },
    { status: 500 },
  );
}
