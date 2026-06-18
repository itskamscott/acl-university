import Link from "next/link";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["pending", "invoiced", "received", "paid_out"] as const;
type PayoutStatus = (typeof STATUSES)[number];
const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "Pending",
  invoiced: "Invoiced",
  received: "Received",
  paid_out: "Paid out",
};

export default async function PayoutsPage() {
  const profile = await getStaffProfileOrRedirect();
  const supabase = await createClient();

  const { data: payouts } = await supabase
    .from("payouts")
    .select(
      `
      id, status, gross_amount, acl_fee, athlete_net, paid_at, created_at,
      contracts ( id, title, brand_name, athletes ( id, full_name ) ),
      teams ( id, name ),
      organizations ( id, name )
    `,
    )
    .order("created_at", { ascending: false });

  type Joined = {
    id: string;
    status: PayoutStatus;
    gross_amount: number;
    acl_fee: number;
    athlete_net: number;
    paid_at: string | null;
    created_at: string;
    contracts: {
      id: string;
      title: string | null;
      brand_name: string | null;
      athletes: { id: string; full_name: string | null } | null;
    } | null;
    teams: { id: string; name: string } | null;
    organizations: { id: string; name: string } | null;
  };
  const rows = (payouts ?? []) as Joined[];

  // Stats strip
  const totals = STATUSES.reduce(
    (acc, s) => {
      acc[s] = { count: 0, gross: 0, fee: 0 };
      return acc;
    },
    {} as Record<PayoutStatus, { count: number; gross: number; fee: number }>,
  );
  for (const r of rows) {
    const bucket = totals[r.status];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.gross += Number(r.gross_amount ?? 0);
    bucket.fee += Number(r.acl_fee ?? 0);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-acl-black dark:text-zinc-100">Payouts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {profile.role === "acl_admin"
            ? "Every deal, across every university."
            : profile.role === "university_admin"
              ? "Deals in your university."
              : "Deals on the teams you manage."}
        </p>
      </header>

      {/* Status strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <div
            key={s}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          >
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
              {STATUS_LABEL[s]}
            </p>
            <p className="mt-0.5 text-xl font-bold text-acl-black dark:text-zinc-100">
              {totals[s].count}
            </p>
            {totals[s].fee > 0 && (
              <p className="text-[11px] text-zinc-500">{fmtMoney(totals[s].fee)} fee</p>
            )}
          </div>
        ))}
      </section>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">
            No payouts yet. A payout row is created automatically when a deal moves
            to <span className="font-semibold">Paid</span>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <tr>
                <Th>Deal</Th>
                <Th>Athlete</Th>
                <Th>Team / Org</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">ACL fee</Th>
                <Th className="text-right">Athlete net</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    {r.contracts ? (
                      <Link
                        href={`/contracts/${r.contracts.id}`}
                        className="text-acl-blue hover:underline"
                      >
                        {r.contracts.title ?? "(untitled)"}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {r.contracts?.brand_name && (
                      <div className="text-[11px] text-zinc-500 truncate">
                        {r.contracts.brand_name}
                      </div>
                    )}
                  </Td>
                  <Td className="truncate max-w-[180px]">
                    {r.contracts?.athletes?.full_name ?? "—"}
                  </Td>
                  <Td className="text-zinc-500 text-xs">
                    {r.teams?.name ?? "—"}
                    {r.organizations?.name ? (
                      <div className="truncate">{r.organizations.name}</div>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{fmtMoney(r.gross_amount)}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(r.acl_fee)}</Td>
                  <Td className="text-right tabular-nums font-semibold">
                    {fmtMoney(r.athlete_net)}
                  </Td>
                  <Td>
                    <StatusPill status={r.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {profile.role !== "acl_admin" && (
        <p className="text-[11px] text-zinc-500">
          Payout-status transitions (Pending → Invoiced → Received → Paid out) are
          ACL admin actions. They'll appear here in the next build.
        </p>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-[11px] uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function StatusPill({ status }: { status: PayoutStatus }) {
  const tone =
    status === "paid_out"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : status === "received"
        ? "bg-acl-blue/10 text-acl-blue"
        : status === "invoiced"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
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
