import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface BrandDue {
  id: string;
  business_name: string;
  status: string;
  next_followup_date: string;
  athlete_id: string;
}

interface AthleteInfo {
  id: string;
  full_name: string;
  email: string;
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

function buildEmail(athleteName: string, dueBrands: BrandDue[], today: string): string {
  const origin = appOrigin();
  const firstName = athleteName.split(" ")[0] || athleteName;
  const lines = dueBrands.map((b) => {
    const overdueDays = Math.max(
      0,
      Math.floor(
        (new Date(today).getTime() - new Date(b.next_followup_date).getTime()) / 86_400_000,
      ),
    );
    const statusLabel = b.status.replace(/_/g, " ");
    const tag = overdueDays > 0 ? ` — overdue ${overdueDays}d` : "";
    return `• ${b.business_name} (${statusLabel})${tag}\n  ${origin}/brands/${b.id}`;
  });
  return [
    `Hey ${firstName},`,
    "",
    `You've got ${dueBrands.length} follow-up${dueBrands.length === 1 ? "" : "s"} on your pipeline today:`,
    "",
    ...lines,
    "",
    `Open your dashboard: ${origin}/dashboard`,
    "",
    "— ACL+",
  ].join("\n");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: brands, error: brandsError } = await admin
    .from("brands")
    .select("id, business_name, status, next_followup_date, athlete_id")
    .not("next_followup_date", "is", null)
    .lte("next_followup_date", today)
    .neq("status", "deal_closed")
    .neq("status", "not_a_fit")
    .is("archived_at", null)
    .order("next_followup_date", { ascending: true });

  if (brandsError) {
    console.error("Cron brands query failed:", brandsError);
    return NextResponse.json({ error: brandsError.message }, { status: 500 });
  }

  const byAthlete = new Map<string, BrandDue[]>();
  for (const b of (brands ?? []) as BrandDue[]) {
    if (!byAthlete.has(b.athlete_id)) byAthlete.set(b.athlete_id, []);
    byAthlete.get(b.athlete_id)!.push(b);
  }

  if (byAthlete.size === 0) {
    return NextResponse.json({ ok: true, athletes_notified: 0, brands_due: 0 });
  }

  const athleteIds = Array.from(byAthlete.keys());
  const { data: athletes } = await admin
    .from("athletes")
    .select("id, full_name, email")
    .in("id", athleteIds)
    .eq("email_follow_up_reminders", true);

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "ACL+ <onboarding@resend.dev>";
  const resend = resendKey ? new Resend(resendKey) : null;

  let sent = 0;
  const errors: string[] = [];

  for (const athlete of (athletes ?? []) as AthleteInfo[]) {
    const dueBrands = byAthlete.get(athlete.id) ?? [];
    if (dueBrands.length === 0) continue;
    if (!resend) {
      errors.push("RESEND_API_KEY not configured");
      break;
    }
    try {
      const body = buildEmail(athlete.full_name, dueBrands, today);
      const { error } = await resend.emails.send({
        from,
        to: athlete.email,
        subject: `${dueBrands.length} follow-up${dueBrands.length === 1 ? "" : "s"} due today`,
        text: body,
      });
      if (error) {
        errors.push(`${athlete.email}: ${error.message ?? "send failed"}`);
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(`${athlete.email}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    athletes_notified: sent,
    brands_due: brands?.length ?? 0,
    errors,
  });
}
