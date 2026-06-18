import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";
import { createClient } from "@/lib/supabase/server";
import { advanceContractAclStatus } from "@/lib/contract-actions";
import { AmountEditor, PercentageEditor } from "./editors";

const STAGES = [
  "proposed",
  "agreement_attached",
  "acl_review",
  "active",
  "deliverables",
  "paid",
  "cancelled",
] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  proposed: "Proposed",
  agreement_attached: "Agreement attached",
  acl_review: "ACL review",
  active: "Active",
  deliverables: "Deliverables",
  paid: "Paid",
  cancelled: "Cancelled",
};

// Allowed forward transitions. Cancel can happen from most stages.
const FORWARD: Partial<Record<Stage, Stage[]>> = {
  proposed: ["agreement_attached", "cancelled"],
  agreement_attached: ["acl_review", "cancelled"],
  acl_review: ["active", "agreement_attached", "cancelled"],
  active: ["deliverables", "cancelled"],
  deliverables: ["paid", "active", "cancelled"],
  paid: ["acl_review"],
};

// Mirror of the action's gating — used here to decide whether to render the
// button at all for non-acl-admins (the action also enforces server-side).
const ACL_ADMIN_ONLY: Array<[Stage, Stage]> = [
  ["agreement_attached", "acl_review"],
  ["acl_review", "active"],
  ["deliverables", "paid"],
  ["paid", "acl_review"],
  ["paid", "deliverables"],
];
function isGated(from: Stage, to: Stage) {
  return ACL_ADMIN_ONLY.some(([f, t]) => f === from && t === to);
}

export default async function StaffContractDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getStaffProfileOrRedirect();
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      `
      *,
      brands ( id, business_name ),
      athletes ( id, full_name, sport, instagram_handle ),
      teams ( id, name, sport, organizations ( id, name ) )
    `,
    )
    .eq("id", id)
    .maybeSingle();
  if (!contract) notFound();

  const [{ data: deliverables }, { data: payments }, { data: payout }] =
    await Promise.all([
      supabase
        .from("deliverables")
        .select("id, description, due_date, completed_at, order_index")
        .eq("contract_id", id)
        .order("order_index", { ascending: true }),
      supabase
        .from("contract_payments")
        .select("id, amount_cents, due_date, received_at, notes")
        .eq("contract_id", id),
      supabase
        .from("payouts")
        .select("id, gross_amount, acl_fee, athlete_net, status, paid_at, created_at")
        .eq("contract_id", id)
        .maybeSingle(),
    ]);

  type Athlete = { id: string; full_name: string; sport: string | null; instagram_handle: string | null };
  type Brand = { id: string; business_name: string };
  type Org = { id: string; name: string };
  type Team = { id: string; name: string; sport: string | null; organizations: Org | null };

  const athlete = contract.athletes as Athlete | null;
  const brand = contract.brands as Brand | null;
  const team = contract.teams as Team | null;
  const org = team?.organizations ?? null;

  const acl_status = (contract.acl_status ?? "proposed") as Stage;
  const acl_pct = contract.acl_percentage as number | null;
  const gross = contract.gross_amount as number | null;

  const allowedTransitions = (FORWARD[acl_status] ?? []).filter(
    (to) => profile.role === "acl_admin" || !isGated(acl_status, to),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">
            <Link href="/teams" className="hover:underline">Teams</Link>
            {team ? <> / <Link href={`/teams/${team.id}`} className="hover:underline">{team.name}</Link></> : null}
            {" / Contract"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-acl-black dark:text-zinc-100 truncate">
            {contract.title ?? "(untitled)"}
          </h1>
          <p className="text-sm text-zinc-500 truncate">
            {brand?.business_name ?? contract.brand_name ?? "Unnamed brand"}
            {" · "}
            {athlete?.full_name ?? "Unknown athlete"}
            {org ? ` · ${org.name}` : ""}
          </p>
        </div>
        <StatusBadge stage={acl_status} />
      </header>

      {/* ACL routing card */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
            ACL routing
          </h2>
          <span className="text-xs text-zinc-500">Current: {STAGE_LABEL[acl_status]}</span>
        </div>

        {allowedTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions.map((to) => (
              <form
                key={to}
                action={async () => {
                  "use server";
                  await advanceContractAclStatus(id, to);
                }}
              >
                <button
                  type="submit"
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition ${
                    to === "cancelled"
                      ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  Move to {STAGE_LABEL[to]}
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            No transitions available from this stage for your role.
          </p>
        )}
      </section>

      {/* Money card */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide mb-3">
          Money
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AmountEditor contractId={id} current={gross} />
          <PercentageEditor
            contractId={id}
            current={acl_pct}
            disabled={profile.role !== "acl_admin"}
          />
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Athlete net (est.)</p>
            <p className="mt-1 text-lg font-bold text-acl-black dark:text-zinc-100">
              {gross !== null && acl_pct !== null
                ? fmtMoney(gross - (gross * acl_pct) / 100)
                : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Payout */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide mb-3">
          Payout
        </h2>
        {payout ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="Status" value={payout.status} />
            <Field label="Gross" value={fmtMoney(payout.gross_amount)} />
            <Field label="ACL fee" value={fmtMoney(payout.acl_fee)} />
            <Field label="Athlete net" value={fmtMoney(payout.athlete_net)} />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            No payout yet. Created automatically when the deal moves to{" "}
            <span className="font-semibold">Paid</span>.
          </p>
        )}
      </section>

      {/* Deliverables + payments — read-only here; athlete-side keeps the editing UI for now */}
      {(deliverables?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide mb-3">
            Deliverables ({deliverables!.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {deliverables!.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="truncate">
                  {d.description}
                  {d.due_date ? <span className="text-zinc-500"> · due {d.due_date}</span> : null}
                </span>
                <span className="text-xs shrink-0 ml-2 text-zinc-500">
                  {d.completed_at ? "Done" : "Open"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(payments?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide mb-3">
            Payments ({payments!.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {payments!.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>
                  {fmtMoney((p.amount_cents ?? 0) / 100)}
                  {p.due_date ? <span className="text-zinc-500"> · due {p.due_date}</span> : null}
                </span>
                <span className="text-xs text-zinc-500">
                  {p.received_at ? `Received ${p.received_at}` : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ stage }: { stage: Stage }) {
  const tone =
    stage === "paid"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : stage === "cancelled"
        ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        : stage === "acl_review"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : "bg-acl-blue/10 text-acl-blue";
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-acl-black dark:text-zinc-100">{value}</p>
    </div>
  );
}

function fmtMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}
