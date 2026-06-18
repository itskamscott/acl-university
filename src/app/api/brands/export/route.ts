import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const COLUMNS: { header: string; field: string }[] = [
  { header: "Business", field: "business_name" },
  { header: "Category", field: "category" },
  { header: "City", field: "city" },
  { header: "State", field: "state" },
  { header: "Website", field: "website" },
  { header: "Instagram", field: "instagram_handle" },
  { header: "Contact Name", field: "contact_name" },
  { header: "Contact Email", field: "contact_email" },
  { header: "Contact Phone", field: "contact_phone" },
  { header: "Notes", field: "notes" },
  { header: "Status", field: "status" },
  { header: "Next Follow-up", field: "next_followup_date" },
  { header: "Created", field: "created_at" },
  { header: "Updated", field: "updated_at" },
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .eq("athlete_id", athlete.id)
    .order("updated_at", { ascending: false });

  const rows = brands ?? [];
  const header = COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const body = rows
    .map((row) =>
      COLUMNS.map((c) => csvEscape((row as Record<string, unknown>)[c.field])).join(","),
    )
    .join("\n");

  const csv = `${header}\n${body}${body ? "\n" : ""}`;
  const today = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="acl-brands-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
