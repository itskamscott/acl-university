import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateBrand } from "@/lib/brands/resolver";

export const COACH_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "add_brand",
    description:
      "Create a new brand in the athlete's CRM. Use when the athlete asks to add, track, or save a brand. Infer a reasonable category if the athlete doesn't specify one.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string", description: "Official business / brand name" },
        category: {
          type: "string",
          enum: ["restaurant", "fitness", "retail", "auto", "healthcare", "real_estate", "other"],
          description: "Business category. Use 'other' if none fit.",
        },
        city: { type: "string" },
        state: { type: "string", description: "US state abbreviation if known, e.g. KS" },
        website: { type: "string" },
        instagram_handle: { type: "string" },
        contact_name: { type: "string" },
        contact_email: { type: "string" },
        contact_phone: { type: "string" },
        notes: { type: "string" },
      },
      required: ["business_name", "category"],
    },
  },
  {
    name: "update_brand_status",
    description:
      "Move a brand to a new pipeline status. Match by business name (case-insensitive, exact preferred).",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        new_status: {
          type: "string",
          enum: [
            "prospect",
            "contacted",
            "in_conversation",
            "negotiating",
            "deal_closed",
            "not_a_fit",
          ],
        },
      },
      required: ["business_name", "new_status"],
    },
  },
  {
    name: "set_followup_date",
    description: "Set a brand's next follow-up date (ISO YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["business_name", "date"],
    },
  },
  {
    name: "log_outreach",
    description:
      "Log that the athlete reached out (or just reached out) to a brand. Use when the athlete tells you they emailed, DM'd, called, or met someone.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        channel: {
          type: "string",
          enum: ["email", "dm", "call", "in_person", "other"],
        },
        content: {
          type: "string",
          description: "Summary of what they said or the message they sent",
        },
        response_received: {
          type: "boolean",
          description: "Only set if the athlete has said whether the brand replied",
        },
      },
      required: ["business_name", "channel", "content"],
    },
  },
  {
    name: "add_note",
    description:
      "Attach a note to a brand (observation, reminder, internal fact). Not an outreach.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        content: { type: "string" },
      },
      required: ["business_name", "content"],
    },
  },
  {
    name: "list_brands",
    description:
      "Search the athlete's full brand list with filters. Use when answering questions like 'who haven't I followed up with?' or 'which restaurants am I in conversation with?' — goes beyond the 20-brand snapshot in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "prospect",
            "contacted",
            "in_conversation",
            "negotiating",
            "deal_closed",
            "not_a_fit",
          ],
          description: "Filter to a single pipeline status.",
        },
        category: {
          type: "string",
          enum: ["restaurant", "fitness", "retail", "auto", "healthcare", "real_estate", "other"],
        },
        followup_state: {
          type: "string",
          enum: ["overdue", "due_today", "this_week", "none_set"],
          description: "Filter by follow-up urgency.",
        },
        include_archived: {
          type: "boolean",
          description: "Default false.",
        },
        max_results: {
          type: "integer",
          description: "Default 20, max 50.",
        },
      },
    },
  },
  {
    name: "get_brand_activities",
    description:
      "Look up the recent activity log for a specific brand (outreach, notes, status changes). Useful before drafting follow-up outreach.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        limit: { type: "integer", description: "Default 10, max 30." },
      },
      required: ["business_name"],
    },
  },
  {
    name: "create_contract",
    description:
      "Create a contract record for the athlete. Use when they ask you to 'draft a contract', 'generate a contract', or record terms of a deal. If you drafted contract text inside this reply, pass it as generated_content so we save it alongside the record.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title, e.g. 'Main Street Pizza — Gameday Deal'" },
        brand_name: { type: "string", description: "Link to an existing brand in the CRM if applicable." },
        total_value_cents: {
          type: "integer",
          description: "Total deal value in cents (e.g. 500 dollars = 50000).",
        },
        signed_at: { type: "string", description: "YYYY-MM-DD if already signed" },
        status: {
          type: "string",
          enum: ["draft", "active", "completed", "cancelled"],
          description: "Default 'draft' for brand-new contracts.",
        },
        notes: { type: "string", description: "Short summary of payment terms, usage rights, etc." },
        generated_content: {
          type: "string",
          description: "Full contract text you drafted in markdown/plain text. Saved alongside the contract.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "add_deliverable",
    description:
      "Add a deliverable (a task the athlete owes the brand) to an existing contract.",
    input_schema: {
      type: "object",
      properties: {
        contract_title: { type: "string" },
        description: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["contract_title", "description"],
    },
  },
  {
    name: "mark_deliverable_complete",
    description:
      "Mark a deliverable as done. Match on a substring of the description within the named contract.",
    input_schema: {
      type: "object",
      properties: {
        contract_title: { type: "string" },
        description_match: { type: "string", description: "Substring that identifies the deliverable." },
      },
      required: ["contract_title", "description_match"],
    },
  },
  {
    name: "add_payment",
    description:
      "Record a scheduled or received payment for a contract.",
    input_schema: {
      type: "object",
      properties: {
        contract_title: { type: "string" },
        amount_cents: { type: "integer", description: "In cents." },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        received: {
          type: "boolean",
          description: "True if this payment has already been received (sets received_at to today).",
        },
        notes: { type: "string" },
      },
      required: ["contract_title", "amount_cents"],
    },
  },
  {
    name: "list_contracts",
    description: "List the athlete's contracts, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "active", "completed", "cancelled"],
        },
      },
    },
  },
  {
    name: "add_content_post",
    description:
      "Save a content idea, draft, or scheduled post to the athlete's content calendar. If you drafted a caption in this reply, pass it as caption so it's stored with the post.",
    input_schema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "youtube", "x", "other"],
        },
        status: {
          type: "string",
          enum: ["idea", "drafted", "scheduled", "posted"],
          description: "Default 'drafted' if you're saving a caption you wrote; 'idea' if just a concept.",
        },
        title: { type: "string", description: "Short internal title, e.g. 'Spring Gameday carousel'." },
        caption: { type: "string", description: "Full caption text to post." },
        planned_for: { type: "string", description: "YYYY-MM-DD" },
        brand_name: {
          type: "string",
          description: "If it's a paid partnership, the brand name. Auto-creates the brand if needed.",
        },
        notes: { type: "string" },
      },
      required: ["platform"],
    },
  },
  {
    name: "update_content_status",
    description:
      "Move a content post through its pipeline — most commonly to mark it as posted with the live URL. Match by title or caption substring.",
    input_schema: {
      type: "object",
      properties: {
        match: { type: "string", description: "Substring of title or caption to find the post." },
        new_status: {
          type: "string",
          enum: ["idea", "drafted", "scheduled", "posted"],
        },
        posted_url: { type: "string", description: "Live post URL. Pass when new_status is 'posted'." },
      },
      required: ["match", "new_status"],
    },
  },
  {
    name: "list_content",
    description: "List the athlete's content posts, optionally filtered by status or platform.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["idea", "drafted", "scheduled", "posted"],
        },
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "youtube", "x", "other"],
        },
      },
    },
  },
];

async function findBrandByName(
  supabase: SupabaseClient,
  athleteId: string,
  name: string,
): Promise<{ ok: true; id: string; business_name: string } | { ok: false; error: string }> {
  const { data: matches } = await supabase
    .from("brands")
    .select("id, business_name")
    .eq("athlete_id", athleteId)
    .is("archived_at", null)
    .ilike("business_name", name);

  if (matches && matches.length === 1) {
    return { ok: true, id: matches[0].id as string, business_name: matches[0].business_name as string };
  }
  if (matches && matches.length > 1) {
    return {
      ok: false,
      error: `Multiple brands match "${name}": ${matches.map((m) => m.business_name).join(", ")}. Ask the athlete which one.`,
    };
  }

  // Fallback: substring match
  const { data: partial } = await supabase
    .from("brands")
    .select("id, business_name")
    .eq("athlete_id", athleteId)
    .is("archived_at", null)
    .ilike("business_name", `%${name}%`)
    .limit(5);

  if (partial && partial.length === 1) {
    return { ok: true, id: partial[0].id as string, business_name: partial[0].business_name as string };
  }
  if (partial && partial.length > 1) {
    return {
      ok: false,
      error: `Multiple brands partially match "${name}": ${partial.map((m) => m.business_name).join(", ")}. Ask the athlete which one.`,
    };
  }
  return {
    ok: false,
    error: `No brand named "${name}" in the CRM. The athlete may need to add it first.`,
  };
}

async function findContractByTitle(
  supabase: SupabaseClient,
  athleteId: string,
  title: string,
): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "contract_title is required." };
  const { data: matches } = await supabase
    .from("contracts")
    .select("id, title")
    .eq("athlete_id", athleteId)
    .ilike("title", `%${trimmed}%`)
    .limit(5);
  if (!matches || matches.length === 0) {
    return { ok: false, error: `No contract matching "${trimmed}".` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: `Multiple contracts match "${trimmed}": ${matches.map((m) => m.title).join(", ")}. Use a more specific title.`,
    };
  }
  return { ok: true, id: matches[0].id as string, title: matches[0].title as string };
}

interface ToolContext {
  athleteId: string;
  supabase: SupabaseClient;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  try {
    if (name === "add_brand") {
      const businessName = String(input.business_name ?? "").trim();
      const category = String(input.category ?? "").trim();
      if (!businessName || !category) return "Error: business_name and category are required.";

      const { data, error } = await ctx.supabase
        .from("brands")
        .insert({
          athlete_id: ctx.athleteId,
          business_name: businessName,
          category,
          city: input.city ? String(input.city) : null,
          state: input.state ? String(input.state) : null,
          website: input.website ? String(input.website) : null,
          instagram_handle: input.instagram_handle ? String(input.instagram_handle) : null,
          contact_name: input.contact_name ? String(input.contact_name) : null,
          contact_email: input.contact_email ? String(input.contact_email) : null,
          contact_phone: input.contact_phone ? String(input.contact_phone) : null,
          notes: input.notes ? String(input.notes) : null,
        })
        .select("id, business_name")
        .single();
      if (error || !data) return `Error: ${error?.message ?? "insert failed"}`;
      return `Added ${data.business_name} (id ${data.id}) as a ${category}.`;
    }

    if (name === "update_brand_status") {
      const match = await findBrandByName(ctx.supabase, ctx.athleteId, String(input.business_name ?? ""));
      if (!match.ok) return `Error: ${match.error}`;
      const newStatus = String(input.new_status);
      const { error } = await ctx.supabase
        .from("brands")
        .update({ status: newStatus })
        .eq("id", match.id);
      if (error) return `Error: ${error.message}`;
      await ctx.supabase.from("brand_activities").insert({
        brand_id: match.id,
        athlete_id: ctx.athleteId,
        activity_type: "status_change",
        content: `Status changed to ${newStatus.replace(/_/g, " ")} by AI Assistant`,
      });
      return `Moved ${match.business_name} to ${newStatus.replace(/_/g, " ")}.`;
    }

    if (name === "set_followup_date") {
      const match = await findBrandByName(ctx.supabase, ctx.athleteId, String(input.business_name ?? ""));
      if (!match.ok) return `Error: ${match.error}`;
      const date = String(input.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Error: date must be YYYY-MM-DD.";
      const { error } = await ctx.supabase
        .from("brands")
        .update({ next_followup_date: date })
        .eq("id", match.id);
      if (error) return `Error: ${error.message}`;
      return `Set follow-up for ${match.business_name} to ${date}.`;
    }

    if (name === "log_outreach") {
      const match = await findBrandByName(ctx.supabase, ctx.athleteId, String(input.business_name ?? ""));
      if (!match.ok) return `Error: ${match.error}`;
      const channel = String(input.channel);
      const content = String(input.content ?? "").trim();
      if (!content) return "Error: content is required.";
      const responseReceived =
        typeof input.response_received === "boolean" ? input.response_received : null;
      const { error } = await ctx.supabase.from("brand_activities").insert({
        brand_id: match.id,
        athlete_id: ctx.athleteId,
        activity_type: "outreach",
        channel,
        content,
        response_received: responseReceived,
      });
      if (error) return `Error: ${error.message}`;
      return `Logged ${channel} outreach to ${match.business_name}.`;
    }

    if (name === "add_note") {
      const match = await findBrandByName(ctx.supabase, ctx.athleteId, String(input.business_name ?? ""));
      if (!match.ok) return `Error: ${match.error}`;
      const content = String(input.content ?? "").trim();
      if (!content) return "Error: content is required.";
      const { error } = await ctx.supabase.from("brand_activities").insert({
        brand_id: match.id,
        athlete_id: ctx.athleteId,
        activity_type: "note",
        content,
      });
      if (error) return `Error: ${error.message}`;
      return `Noted on ${match.business_name}: ${content}`;
    }

    if (name === "list_brands") {
      const maxResults = Math.max(1, Math.min(50, Number(input.max_results ?? 20)));
      let query = ctx.supabase
        .from("brands")
        .select("business_name, category, city, state, status, next_followup_date, contact_name, notes, updated_at")
        .eq("athlete_id", ctx.athleteId);

      if (!input.include_archived) {
        query = query.is("archived_at", null);
      }
      if (input.status) query = query.eq("status", String(input.status));
      if (input.category) query = query.eq("category", String(input.category));

      const today = new Date().toISOString().split("T")[0];
      if (input.followup_state === "overdue") {
        query = query.lt("next_followup_date", today);
      } else if (input.followup_state === "due_today") {
        query = query.eq("next_followup_date", today);
      } else if (input.followup_state === "this_week") {
        const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
        query = query.gte("next_followup_date", today).lte("next_followup_date", in7);
      } else if (input.followup_state === "none_set") {
        query = query.is("next_followup_date", null);
      }

      const { data, error } = await query
        .order("next_followup_date", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(maxResults);

      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No brands match those filters.";

      const lines = data.map((b) => {
        const loc = [b.city, b.state].filter(Boolean).join(", ");
        const parts = [
          `- ${b.business_name} (${b.category})`,
          `Status: ${String(b.status).replace(/_/g, " ")}`,
          loc ? `Location: ${loc}` : null,
          b.contact_name ? `Contact: ${b.contact_name}` : null,
          b.next_followup_date ? `Follow-up: ${b.next_followup_date}` : null,
          b.notes ? `Notes: ${b.notes}` : null,
        ].filter(Boolean);
        return parts.join(" | ");
      });
      return `Found ${data.length} brand${data.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
    }

    if (name === "create_contract") {
      const title = String(input.title ?? "").trim();
      if (!title) return "Error: title is required.";

      const signedAt = input.signed_at ? String(input.signed_at) : null;

      let brandId: string | null = null;
      let brandCreatedNote = "";
      if (input.brand_name) {
        const resolution = await findOrCreateBrand(
          ctx.supabase,
          ctx.athleteId,
          String(input.brand_name),
          { statusOnCreate: signedAt ? "deal_closed" : "negotiating" },
        );
        if (!resolution.ok) return `Error: ${resolution.error}`;
        brandId = resolution.brand.id;
        if (resolution.brand.created) {
          brandCreatedNote = ` Added "${resolution.brand.business_name}" as a new brand.`;
        }
      }

      const statusInput = String(input.status ?? "draft");
      const validStatuses = ["draft", "active", "completed", "cancelled"];
      const status = validStatuses.includes(statusInput) ? statusInput : "draft";

      const totalValueCents =
        typeof input.total_value_cents === "number" ? Math.round(input.total_value_cents) : null;

      const generatedContent = input.generated_content ? String(input.generated_content) : null;

      const { data, error } = await ctx.supabase
        .from("contracts")
        .insert({
          athlete_id: ctx.athleteId,
          brand_id: brandId,
          title,
          total_value_cents: totalValueCents,
          signed_at: signedAt,
          status,
          source: generatedContent ? "generated" : "manual",
          generated_content: generatedContent,
          notes: input.notes ? String(input.notes) : null,
        })
        .select("id, title")
        .single();
      if (error || !data) return `Error: ${error?.message ?? "insert failed"}`;
      return `Created contract "${data.title}" (id ${data.id}).${brandCreatedNote}`;
    }

    if (name === "add_deliverable") {
      const contractMatch = await findContractByTitle(
        ctx.supabase,
        ctx.athleteId,
        String(input.contract_title ?? ""),
      );
      if (!contractMatch.ok) return `Error: ${contractMatch.error}`;
      const description = String(input.description ?? "").trim();
      if (!description) return "Error: description is required.";
      const { data: existing } = await ctx.supabase
        .from("deliverables")
        .select("id", { count: "exact", head: true })
        .eq("contract_id", contractMatch.id);
      const orderIndex = existing ? 0 : 0;
      void orderIndex;
      const { error } = await ctx.supabase.from("deliverables").insert({
        contract_id: contractMatch.id,
        athlete_id: ctx.athleteId,
        description,
        due_date: input.due_date ? String(input.due_date) : null,
      });
      if (error) return `Error: ${error.message}`;
      return `Added deliverable to ${contractMatch.title}: ${description}`;
    }

    if (name === "mark_deliverable_complete") {
      const contractMatch = await findContractByTitle(
        ctx.supabase,
        ctx.athleteId,
        String(input.contract_title ?? ""),
      );
      if (!contractMatch.ok) return `Error: ${contractMatch.error}`;
      const needle = String(input.description_match ?? "").trim();
      if (!needle) return "Error: description_match is required.";
      const { data: candidates } = await ctx.supabase
        .from("deliverables")
        .select("id, description, completed_at")
        .eq("contract_id", contractMatch.id)
        .ilike("description", `%${needle}%`)
        .is("completed_at", null)
        .limit(5);
      if (!candidates || candidates.length === 0) {
        return `Error: no open deliverable matching "${needle}" on contract "${contractMatch.title}".`;
      }
      if (candidates.length > 1) {
        return `Multiple matches for "${needle}": ${candidates.map((d) => d.description).join(", ")}. Narrow it down.`;
      }
      const { error } = await ctx.supabase
        .from("deliverables")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", candidates[0].id);
      if (error) return `Error: ${error.message}`;
      return `Marked deliverable done: ${candidates[0].description}`;
    }

    if (name === "add_payment") {
      const contractMatch = await findContractByTitle(
        ctx.supabase,
        ctx.athleteId,
        String(input.contract_title ?? ""),
      );
      if (!contractMatch.ok) return `Error: ${contractMatch.error}`;
      const amount = typeof input.amount_cents === "number" ? Math.round(input.amount_cents) : NaN;
      if (!Number.isFinite(amount) || amount <= 0) return "Error: amount_cents must be a positive integer.";
      const receivedAt = input.received ? new Date().toISOString().split("T")[0] : null;
      const { error } = await ctx.supabase.from("contract_payments").insert({
        contract_id: contractMatch.id,
        athlete_id: ctx.athleteId,
        amount_cents: amount,
        due_date: input.due_date ? String(input.due_date) : null,
        received_at: receivedAt,
        notes: input.notes ? String(input.notes) : null,
      });
      if (error) return `Error: ${error.message}`;
      const dollars = (amount / 100).toFixed(amount % 100 === 0 ? 0 : 2);
      return `Added $${dollars} payment to ${contractMatch.title}${receivedAt ? " (received today)" : ""}.`;
    }

    if (name === "list_contracts") {
      let query = ctx.supabase
        .from("contracts")
        .select("title, status, total_value_cents, signed_at, brands(business_name)")
        .eq("athlete_id", ctx.athleteId);
      if (input.status) query = query.eq("status", String(input.status));
      const { data, error } = await query.order("created_at", { ascending: false }).limit(30);
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No contracts match.";
      const lines = data.map((c) => {
        const brand = (c as { brands?: { business_name?: string } | null }).brands?.business_name;
        const value = c.total_value_cents !== null
          ? `$${((c.total_value_cents as number) / 100).toFixed(0)}`
          : "—";
        return `- ${c.title} (${String(c.status).replace(/_/g, " ")}) | ${brand ?? "no brand"} | ${value}`;
      });
      return `Found ${data.length} contract${data.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
    }

    if (name === "get_brand_activities") {
      const match = await findBrandByName(ctx.supabase, ctx.athleteId, String(input.business_name ?? ""));
      if (!match.ok) return `Error: ${match.error}`;
      const limit = Math.max(1, Math.min(30, Number(input.limit ?? 10)));
      const { data, error } = await ctx.supabase
        .from("brand_activities")
        .select("activity_type, channel, content, response_received, created_at")
        .eq("brand_id", match.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return `No activity logged for ${match.business_name} yet.`;
      const lines = data.map((a) => {
        const date = new Date(a.created_at as string).toISOString().split("T")[0];
        const type = a.activity_type === "status_change"
          ? "Status change"
          : a.activity_type === "outreach"
          ? `Outreach${a.channel ? ` (${a.channel})` : ""}`
          : "Note";
        const response = a.response_received === true
          ? " [replied]"
          : a.response_received === false
          ? " [no reply]"
          : "";
        return `- ${date} | ${type}${response} | ${a.content}`;
      });
      return `Activity for ${match.business_name}:\n${lines.join("\n")}`;
    }

    if (name === "add_content_post") {
      const platform = String(input.platform ?? "").trim();
      const validPlatforms = ["instagram", "tiktok", "youtube", "x", "other"];
      if (!validPlatforms.includes(platform)) return "Error: invalid platform.";

      const statusInput = String(input.status ?? "idea");
      const validStatuses = ["idea", "drafted", "scheduled", "posted"];
      const status = validStatuses.includes(statusInput) ? statusInput : "idea";

      let brandId: string | null = null;
      let brandNote = "";
      if (input.brand_name) {
        const res = await findOrCreateBrand(
          ctx.supabase,
          ctx.athleteId,
          String(input.brand_name),
          { statusOnCreate: "in_conversation" },
        );
        if (!res.ok) return `Error: ${res.error}`;
        brandId = res.brand.id;
        if (res.brand.created) brandNote = ` Added "${res.brand.business_name}" as a new brand.`;
      }

      const { data, error } = await ctx.supabase
        .from("content_posts")
        .insert({
          athlete_id: ctx.athleteId,
          brand_id: brandId,
          platform,
          status,
          title: input.title ? String(input.title).trim() : null,
          caption: input.caption ? String(input.caption).trim() : null,
          planned_for: input.planned_for ? String(input.planned_for) : null,
          notes: input.notes ? String(input.notes).trim() : null,
        })
        .select("id, title, caption")
        .single();
      if (error || !data) return `Error: ${error?.message ?? "insert failed"}`;
      const label = data.title || (data.caption ? String(data.caption).slice(0, 40) : "post");
      return `Saved content post "${label}" (${platform}, ${status}).${brandNote}`;
    }

    if (name === "update_content_status") {
      const match = String(input.match ?? "").trim();
      if (!match) return "Error: match is required.";
      const newStatus = String(input.new_status);
      const validStatuses = ["idea", "drafted", "scheduled", "posted"];
      if (!validStatuses.includes(newStatus)) return "Error: invalid status.";

      const { data: candidates } = await ctx.supabase
        .from("content_posts")
        .select("id, title, caption")
        .eq("athlete_id", ctx.athleteId)
        .or(`title.ilike.%${match}%,caption.ilike.%${match}%`)
        .limit(5);
      if (!candidates || candidates.length === 0) {
        return `Error: no content post matching "${match}".`;
      }
      if (candidates.length > 1) {
        const names = candidates.map((c) => c.title || (c.caption ? String(c.caption).slice(0, 40) : "post")).join(", ");
        return `Multiple posts match "${match}": ${names}. Narrow it down.`;
      }
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "posted") {
        updates.posted_at = new Date().toISOString();
        if (input.posted_url) updates.posted_url = String(input.posted_url);
      }
      const { error } = await ctx.supabase
        .from("content_posts")
        .update(updates)
        .eq("id", candidates[0].id);
      if (error) return `Error: ${error.message}`;
      const label = candidates[0].title || (candidates[0].caption ? String(candidates[0].caption).slice(0, 40) : "post");
      return `Moved "${label}" to ${newStatus}.`;
    }

    if (name === "list_content") {
      let query = ctx.supabase
        .from("content_posts")
        .select("title, caption, platform, status, planned_for, posted_url")
        .eq("athlete_id", ctx.athleteId);
      if (input.status) query = query.eq("status", String(input.status));
      if (input.platform) query = query.eq("platform", String(input.platform));
      const { data, error } = await query
        .order("planned_for", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No content posts match.";
      const lines = data.map((p) => {
        const label = p.title || (p.caption ? String(p.caption).slice(0, 60) : "Untitled");
        const parts = [
          `- ${label}`,
          `${p.platform} / ${p.status}`,
          p.planned_for ? `Planned: ${p.planned_for}` : null,
          p.posted_url ? `URL: ${p.posted_url}` : null,
        ].filter(Boolean);
        return parts.join(" | ");
      });
      return `Found ${data.length} post${data.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
    }

    return `Error: unknown tool "${name}".`;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return `Error: ${message}`;
  }
}
