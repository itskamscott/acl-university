import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Routes a freshly-authenticated user to the right surface based on their
// profiles.role. Sits between /login (and signup completion) and the actual
// dashboards so client code doesn't need to know about role layouts.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(`${origin}/login`, { status: 302 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row yet (e.g. very early in signup before athletes insert) —
  // send to /dashboard which will fall through to the athlete onboarding.
  if (!profile || profile.role === "athlete") {
    return NextResponse.redirect(`${origin}/dashboard`, { status: 302 });
  }

  // Staff roles land on the teams view.
  return NextResponse.redirect(`${origin}/teams`, { status: 302 });
}
