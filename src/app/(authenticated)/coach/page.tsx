import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { CoachChat } from "./coach-chat";

export const metadata = { title: "AI Assistant" };

export default async function CoachPage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  // Resolve the athlete's most recent thread; that's what we render on
  // load. Pre-existing accounts have a single backfilled thread covering
  // all their history (migration 020).
  const { data: latest } = await supabase
    .from("coach_messages")
    .select("thread_id")
    .eq("athlete_id", athlete.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialThreadId = (latest?.thread_id as string | undefined) ?? randomUUID();

  const { data: messages } = await supabase
    .from("coach_messages")
    .select("id, role, content, created_at, image_paths")
    .eq("athlete_id", athlete.id)
    .eq("thread_id", initialThreadId)
    .order("created_at", { ascending: false })
    .limit(20);

  const initialMessages = (messages || []).reverse();

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--mobile-nav-h))] md:h-screen">
      <CoachChat initialMessages={initialMessages} initialThreadId={initialThreadId} />
    </div>
  );
}
