import { redirect } from "next/navigation";
import Link from "next/link";
import { Mail, UsersRound } from "lucide-react";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";
import { POD_SIZE_MAX, POD_SIZE_MIN, type Pod } from "@/lib/types";

export const metadata = { title: "Your Pod" };

interface PodMate {
  id: string;
  full_name: string;
  instagram_handle: string | null;
}

interface LP {
  id: string;
  full_name: string;
  email: string;
  instagram_handle: string | null;
}

export default async function PodPage() {
  const { athlete } = await getAthleteOrRedirect();

  // Members aren't in the program. Founders use the admin surface.
  if (athlete.tier === "member") redirect("/dashboard");
  if (athlete.tier === "founder") redirect("/admin/lab-partners");

  // Service-role client: we bypass RLS but only after gating on the
  // athlete's own tier and only return fields safe for the role.
  const admin = createAdminClient();

  if (athlete.tier === "insider") {
    const { data: membership } = await admin
      .from("pod_memberships")
      .select("pod_id")
      .eq("athlete_id", athlete.id)
      .is("left_at", null)
      .maybeSingle();

    if (!membership) {
      return (
        <PageShell heading="Your Pod">
          <EmptyState
            title="You haven't been assigned to a pod yet"
            body="Your Lab Partner will add you once your pod is set. Reach out to them in Skool if you've been waiting a while."
          />
        </PageShell>
      );
    }

    const { data: pod } = await admin
      .from("pods")
      .select("*")
      .eq("id", membership.pod_id)
      .is("archived_at", null)
      .maybeSingle();

    if (!pod) {
      return (
        <PageShell heading="Your Pod">
          <EmptyState
            title="Your pod was archived"
            body="Reach out to your Lab Partner or the Founders to get reassigned."
          />
        </PageShell>
      );
    }

    const [{ data: lp }, { data: memberRows }] = await Promise.all([
      admin
        .from("athletes")
        .select("id, full_name, email, instagram_handle")
        .eq("id", pod.lab_partner_id)
        .single(),
      admin
        .from("pod_memberships")
        .select("athlete_id, joined_at")
        .eq("pod_id", pod.id)
        .is("left_at", null)
        .order("joined_at", { ascending: true }),
    ]);

    const memberIds = (memberRows ?? []).map((r) => r.athlete_id as string);
    const { data: matesRaw } =
      memberIds.length > 0
        ? await admin
            .from("athletes")
            .select("id, full_name, instagram_handle")
            .in("id", memberIds)
        : { data: [] as PodMate[] };

    // Preserve the joined_at order from memberRows when rendering.
    const matesById = new Map<string, PodMate>();
    for (const m of (matesRaw ?? []) as PodMate[]) matesById.set(m.id, m);
    const mates = memberIds
      .map((id) => matesById.get(id))
      .filter((m): m is PodMate => !!m);

    return (
      <InsiderView
        pod={pod as Pod}
        lp={lp as LP}
        mates={mates}
        selfId={athlete.id}
      />
    );
  }

  // lab_partner
  const { data: ledPodsRaw } = await admin
    .from("pods")
    .select("*")
    .eq("lab_partner_id", athlete.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const ledPods = (ledPodsRaw ?? []) as Pod[];

  if (ledPods.length === 0) {
    return (
      <PageShell heading="Your Pod">
        <EmptyState
          title="You don't have a pod yet"
          body="The Founders will spin one up for you. In the meantime, start identifying the 5–8 Insiders you want to recruit."
        />
      </PageShell>
    );
  }

  const podIds = ledPods.map((p) => p.id);
  const { data: allMembers } = await admin
    .from("pod_memberships")
    .select("id, pod_id, athlete_id, joined_at")
    .in("pod_id", podIds)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  const allMemberRows = (allMembers ?? []) as {
    id: string;
    pod_id: string;
    athlete_id: string;
    joined_at: string;
  }[];

  const memberIds = Array.from(new Set(allMemberRows.map((m) => m.athlete_id)));
  const { data: rosterRaw } =
    memberIds.length > 0
      ? await admin
          .from("athletes")
          .select("id, full_name, email, instagram_handle")
          .in("id", memberIds)
      : { data: [] };

  const rosterById = new Map<string, LP>();
  for (const r of (rosterRaw ?? []) as LP[]) rosterById.set(r.id, r);

  return <LabPartnerView pods={ledPods} memberRows={allMemberRows} rosterById={rosterById} />;
}

// =====================================================================
// Insider view
// =====================================================================
function InsiderView({
  pod,
  lp,
  mates,
  selfId,
}: {
  pod: Pod;
  lp: LP;
  mates: PodMate[];
  selfId: string;
}) {
  const sizeNote = sizeNoteFor(mates.length);

  return (
    <PageShell heading={pod.name} subheading="Your pod">
      {/* Lab Partner card */}
      <section className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-2">
          Your Lab Partner
        </p>
        <div className="flex items-start gap-3">
          <Avatar name={lp.full_name} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
              {lp.full_name}
            </p>
            <ContactLine email={lp.email} instagram={lp.instagram_handle} />
          </div>
        </div>
      </section>

      {/* Pod-mates */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
            Pod-mates
          </h2>
          <p className="text-xs text-zinc-500">
            {mates.length}/{POD_SIZE_MAX}
            {sizeNote ? ` · ${sizeNote}` : ""}
          </p>
        </div>
        <ul className="space-y-1.5">
          {mates.map((m) => {
            const isSelf = m.id === selfId;
            return (
              <li
                key={m.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                  isSelf
                    ? "border-acl-orange/40 bg-acl-orange/5"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                <Avatar name={m.full_name} small />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
                    {m.full_name}
                    {isSelf && <span className="ml-2 text-xs text-acl-orange font-semibold">you</span>}
                  </p>
                  {m.instagram_handle && (
                    <p className="text-xs text-zinc-500 truncate">@{m.instagram_handle}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}

// =====================================================================
// Lab Partner view
// =====================================================================
function LabPartnerView({
  pods,
  memberRows,
  rosterById,
}: {
  pods: Pod[];
  memberRows: { id: string; pod_id: string; athlete_id: string; joined_at: string }[];
  rosterById: Map<string, LP>;
}) {
  const subheading =
    pods.length === 1 ? "You lead this pod" : `You lead ${pods.length} pods`;

  return (
    <PageShell heading="Your Pod" subheading={subheading}>
      <div className="space-y-6">
        {pods.map((pod) => {
          const podMembers = memberRows.filter((m) => m.pod_id === pod.id);
          const sizeNote = sizeNoteFor(podMembers.length);
          return (
            <section key={pod.id}>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-lg font-bold tracking-tight text-acl-black dark:text-zinc-100">
                  {pod.name}
                </h2>
                <p className="text-xs text-zinc-500">
                  {podMembers.length}/{POD_SIZE_MAX}
                  {sizeNote ? ` · ${sizeNote}` : ""}
                </p>
              </div>
              {podMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
                  <p className="text-sm text-zinc-500">
                    No Insiders in this pod yet. The Founders add Insiders from
                    the admin panel — message Kam or Denzel with names you want in.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {podMembers.map((m) => {
                    const a = rosterById.get(m.athlete_id);
                    if (!a) return null;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
                      >
                        <Avatar name={a.full_name} small />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
                            {a.full_name}
                          </p>
                          <ContactLine email={a.email} instagram={a.instagram_handle} small />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}

// =====================================================================
// Shared bits
// =====================================================================
function PageShell({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 md:p-6 max-w-7xl w-full min-w-0">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-bold tracking-tight text-acl-black dark:text-zinc-100">
          <UsersRound className="h-6 w-6 text-acl-orange" />
          {heading}
        </h1>
        {subheading && <p className="mt-1 text-sm text-zinc-500">{subheading}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
      <UsersRound className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
      <p className="mt-3 text-sm font-medium text-acl-black dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">{body}</p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const letter = name.trim().slice(0, 1).toUpperCase() || "?";
  const sizing = small ? "h-9 w-9 text-sm" : "h-12 w-12 text-base";
  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-500 dark:text-zinc-300 ${sizing}`}
    >
      {letter}
    </div>
  );
}

function ContactLine({
  email,
  instagram,
  small = false,
}: {
  email: string;
  instagram: string | null;
  small?: boolean;
}) {
  const cls = small
    ? "text-xs text-zinc-500"
    : "mt-1 text-sm text-zinc-500";
  return (
    <div className={`${cls} flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0`}>
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center gap-1 hover:text-acl-blue truncate max-w-full"
      >
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{email}</span>
      </a>
      {instagram && <span className="truncate">@{instagram}</span>}
    </div>
  );
}

function sizeNoteFor(count: number): string | null {
  if (count < POD_SIZE_MIN) return `below ${POD_SIZE_MIN}`;
  if (count > POD_SIZE_MAX) return `above ${POD_SIZE_MAX}`;
  return null;
}
