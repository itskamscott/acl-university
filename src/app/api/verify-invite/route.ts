import { createClient } from "@supabase/supabase-js";

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
        hasKey: !!serviceRoleKey
      });
      return Response.json({ valid: false, error: "Server configuration error" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, expires_at")
      .eq("code", code.trim().toUpperCase())
      .is("used_by", null)
      .maybeSingle();

    const isExpired = data?.expires_at && new Date(data.expires_at) < new Date();

    if (error) {
      console.error("Invite code query error:", error);
      return Response.json({ valid: false });
    }

    return Response.json({ valid: !!data && !isExpired });
  } catch (err) {
    console.error("Verify invite error:", err);
    return Response.json({ valid: false });
  }
}
