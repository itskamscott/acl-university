import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface AthleteRow {
  id: string;
  full_name: string;
  email: string;
}

interface BrandRow {
  id: string;
  business_name: string;
  status: string;
  next_followup_date: string;
  athlete_id: string;
}

interface DeliverableRow {
  id: string;
  description: string;
  due_date: string;
  contract_id: string;
  athlete_id: string;
}

interface ContentRow {
  id: string;
  title: string | null;
  caption: string | null;
  platform: string;
  planned_for: string;
  athlete_id: string;
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}

function contentLabel(c: ContentRow): string {
  return c.title || (c.caption ? c.caption.slice(0, 60) : "Untitled");
}

function buildDigestEmail(
  athlete: AthleteRow,
  followups: BrandRow[],
  deliverables: DeliverableRow[],
  content: ContentRow[],
): string {
  const origin = appOrigin();
  const firstName = athlete.full_name.split(" ")[0] || athlete.full_name;

  const sections: string[] = [
    `Hey ${firstName},`,
    "",
    "Here's your week ahead on ACL+.",
    "",
  ];

  if (followups.length > 0) {
    sections.push(`## Follow-ups due this week (${followups.length})`);
    for (const b of followups) {
      sections.push(
        `• ${b.business_name} — ${b.next_followup_date} (${b.status.replace(/_/g, " ")})`,
      );
      sections.push(`  ${origin}/brands/${b.id}`);
    }
    sections.push("");
  }

  if (deliverables.length > 0) {
    sections.push(`## Deliverables due this week (${deliverables.length})`);
    for (const d of deliverables) {
      sections.push(`• ${d.description} — ${d.due_date}`);
      sections.push(`  ${origin}/contracts/${d.contract_id}`);
    }
    sections.push("");
  }

  if (content.length > 0) {
    sections.push(`## Content planned this week (${content.length})`);
    for (const c of content) {
      sections.push(`• ${contentLabel(c)} — ${c.platform}, ${c.planned_for}`);
      sections.push(`  ${origin}/content/${c.id}`);
    }
    sections.push("");
  }

  if (followups.length === 0 && deliverables.length === 0 && content.length === 0) {
    sections.push("Nothing scheduled this week — a good time to prospect some new brands or draft content.");
    sections.push("");
  }

  sections.push(`Open your dashboard: ${origin}/dashboard`);
  sections.push("");
  sections.push("— ACL+");

  return sections.join("\n");
}

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const end = addDaysIso(7);

  const [followupRes, deliverableRes, contentRes] = await Promise.all([
    admin
      .from("brands")
      .select("id, business_name, status, next_followup_date, athlete_id")
      .not("next_followup_date", "is", null)
      .gte("next_followup_date", today)
      .lte("next_followup_date", end)
      .neq("status", "deal_closed")
      .neq("status", "not_a_fit")
      .is("archived_at", null),
    admin
      .from("deliverables")
      .select("id, description, due_date, contract_id, athlete_id")
      .is("completed_at", null)
      .not("due_date", "is", null)
      .gte("due_date", today)
      .lte("due_date", end),
    admin
      .from("content_posts")
      .select("id, title, caption, platform, planned_for, athlete_id")
      .in("status", ["drafted", "scheduled"])
      .not("planned_for", "is", null)
      .gte("planned_for", today)
      .lte("planned_for", end),
  ]);

  if (followupRes.error || deliverableRes.error || contentRes.error) {
    const err =
      followupRes.error?.message ??
      deliverableRes.error?.message ??
      contentRes.error?.message ??
      "query failed";
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const followupsByAthlete = new Map<string, BrandRow[]>();
  for (const b of (followupRes.data ?? []) as BrandRow[]) {
    if (!followupsByAthlete.has(b.athlete_id)) followupsByAthlete.set(b.athlete_id, []);
    followupsByAthlete.get(b.athlete_id)!.push(b);
  }

  const deliverablesByAthlete = new Map<string, DeliverableRow[]>();
  for (const d of (deliverableRes.data ?? []) as DeliverableRow[]) {
    if (!deliverablesByAthlete.has(d.athlete_id)) deliverablesByAthlete.set(d.athlete_id, []);
    deliverablesByAthlete.get(d.athlete_id)!.push(d);
  }

  const contentByAthlete = new Map<string, ContentRow[]>();
  for (const c of (contentRes.data ?? []) as ContentRow[]) {
    if (!contentByAthlete.has(c.athlete_id)) contentByAthlete.set(c.athlete_id, []);
    contentByAthlete.get(c.athlete_id)!.push(c);
  }

  const athleteIds = new Set<string>([
    ...followupsByAthlete.keys(),
    ...deliverablesByAthlete.keys(),
    ...contentByAthlete.keys(),
  ]);

  if (athleteIds.size === 0) {
    return NextResponse.json({ ok: true, athletes_notified: 0 });
  }

  const { data: athletes } = await admin
    .from("athletes")
    .select("id, full_name, email")
    .in("id", Array.from(athleteIds))
    .eq("email_weekly_digest", true);

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "ACL+ <onboarding@resend.dev>";
  const resend = resendKey ? new Resend(resendKey) : null;

  let sent = 0;
  const errors: string[] = [];

  for (const athlete of (athletes ?? []) as AthleteRow[]) {
    const followups = followupsByAthlete.get(athlete.id) ?? [];
    const deliverables = deliverablesByAthlete.get(athlete.id) ?? [];
    const content = contentByAthlete.get(athlete.id) ?? [];
    if (followups.length === 0 && deliverables.length === 0 && content.length === 0) continue;
    if (!resend) {
      errors.push("RESEND_API_KEY not configured");
      break;
    }
    try {
      const body = buildDigestEmail(athlete, followups, deliverables, content);
      const { error: sendError } = await resend.emails.send({
        from,
        to: athlete.email,
        subject: "Your week on ACL+",
        text: body,
      });
      if (sendError) {
        errors.push(`${athlete.email}: ${sendError.message ?? "send failed"}`);
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(`${athlete.email}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ ok: true, athletes_notified: sent, errors });
}
