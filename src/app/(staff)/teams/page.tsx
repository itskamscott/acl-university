import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffProfileOrRedirect, getStaffTeams } from "@/lib/get-staff";
import { createClient } from "@/lib/supabase/server";

export default async function TeamsPage() {
  const profile = await getStaffProfileOrRedirect();
  const teams = await getStaffTeams();

  // Team managers usually only manage one team — drop them straight in.
  if (profile.role === "team_manager" && teams.length === 1) {
    redirect(`/teams/${teams[0].id}`);
  }

  // Per-team athlete counts (RLS-scoped to what this staffer can see).
  const supabase = await createClient();
  const athleteCounts = new Map<string, number>();
  if (teams.length > 0) {
    const { data: athletes } = await supabase
      .from("athletes")
      .select("team_id")
      .in("team_id", teams.map((t) => t.id));
    for (const a of athletes ?? []) {
      if (a.team_id) athleteCounts.set(a.team_id, (athleteCounts.get(a.team_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-acl-black dark:text-zinc-100">Teams</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {profile.role === "acl_admin"
            ? "Every team across every university."
            : profile.role === "university_admin"
              ? "Every team in your university."
              : "Teams you manage."}
        </p>
      </header>

      {teams.length === 0 ? (
        <EmptyState role={profile.role} />
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => (
            <li key={t.id}>
              <Link
                href={`/teams/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-acl-orange/40 hover:bg-acl-orange/5 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-acl-black dark:text-zinc-100 truncate">
                    {t.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {t.org?.name ?? "Unassigned org"}
                    {t.sport ? ` · ${t.sport}` : ""}
                  </p>
                </div>
                <span className="text-xs text-zinc-500 shrink-0 ml-3">
                  {athleteCounts.get(t.id) ?? 0} athletes
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ role }: { role: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        No teams yet.
      </p>
      <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
        {role === "team_manager"
          ? "You haven't been assigned to any teams. Ask your athletic director to add you to a team in their roster."
          : role === "university_admin"
            ? "Create your first team to start onboarding athletes. (Team-creation UI is in the next build phase — for now use the database directly.)"
            : "No teams exist yet across any university."}
      </p>
    </div>
  );
}
