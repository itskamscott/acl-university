import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export { EXTRACTION_CREDIT_COST } from "./credit-costs";

interface ExtractedDeliverable {
  description: string;
  due_date: string | null;
}

interface ExtractedPayment {
  amount_cents: number;
  due_date: string | null;
  received: boolean;
  notes: string | null;
}

export interface ContractExtraction {
  deliverables: ExtractedDeliverable[];
  payments: ExtractedPayment[];
  total_value_cents: number | null;
  signed_date: string | null;
  suggested_title: string | null;
  brand_name: string | null;
  summary: string;
}

const SAVE_EXTRACTION_TOOL: Anthropic.Messages.Tool = {
  name: "save_extraction",
  description:
    "Record the structured data you extracted from the contract. Always call this tool exactly once after analyzing the document.",
  input_schema: {
    type: "object",
    properties: {
      deliverables: {
        type: "array",
        description:
          "Every task or piece of content the athlete owes the brand. Split multi-part clauses into one deliverable each.",
        items: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "One sentence, concrete (e.g. 'One Instagram feed post tagging @brand').",
            },
            due_date: {
              type: "string",
              description: "YYYY-MM-DD if the contract names a specific date; null otherwise.",
            },
          },
          required: ["description"],
        },
      },
      payments: {
        type: "array",
        description: "Payments the athlete is owed. Include the full schedule (e.g. 50% deposit + 50% on completion as two entries).",
        items: {
          type: "object",
          properties: {
            amount_cents: {
              type: "integer",
              description: "Amount in cents (e.g. $500 = 50000).",
            },
            due_date: { type: "string", description: "YYYY-MM-DD or null." },
            received: {
              type: "boolean",
              description: "True only if the contract states this payment has already been received.",
            },
            notes: {
              type: "string",
              description: "Short label (e.g. 'deposit', 'on completion', 'monthly retainer').",
            },
          },
          required: ["amount_cents", "received"],
        },
      },
      total_value_cents: {
        type: "integer",
        description: "Total deal value in cents if stated, else null.",
      },
      signed_date: {
        type: "string",
        description: "Date the contract was signed (YYYY-MM-DD), if stated.",
      },
      suggested_title: {
        type: "string",
        description: "Short title suggestion based on the brand and deal (e.g. 'Main Street Pizza — Gameday Deal').",
      },
      brand_name: {
        type: "string",
        description: "The business / brand the athlete is contracting with. Clean official name only.",
      },
      summary: {
        type: "string",
        description: "Two-sentence summary of the deal for the athlete's reference.",
      },
    },
    required: ["deliverables", "payments", "summary"],
  },
};

function mediaTypeFor(path: string): "application/pdf" | "image/jpeg" | "image/png" | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return null;
}

export interface ExtractionContext {
  storage: SupabaseClient;
  filePath: string;
}

export async function extractContractStructure(
  ctx: ExtractionContext,
): Promise<
  | { ok: true; data: ContractExtraction }
  | { ok: false; error: string; skipped?: boolean }
> {
  const mediaType = mediaTypeFor(ctx.filePath);
  if (!mediaType) {
    return {
      ok: false,
      error: "Auto-extract only supports PDF or image files right now.",
      skipped: true,
    };
  }

  const { data: fileData, error: downloadError } = await ctx.storage.storage
    .from("contracts")
    .download(ctx.filePath);
  if (downloadError || !fileData) {
    return { ok: false, error: downloadError?.message ?? "Couldn't download the contract file." };
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = buffer.toString("base64");

  const documentBlock: Anthropic.Messages.ContentBlockParam =
    mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: mediaType, data: base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        };

  const prompt = [
    "Analyze this brand sponsorship contract between a college athlete and a business.",
    "Pull out every deliverable (content or activity the athlete owes) and every payment the athlete is owed.",
    "If a clause lists multiple items (e.g. '3 Instagram posts') split them into separate deliverables.",
    "Convert dollar amounts to cents. Use ISO dates (YYYY-MM-DD) when a specific date is given; otherwise null.",
    "Call save_extraction exactly once with the structured result.",
  ].join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    tools: [SAVE_EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "save_extraction" },
    messages: [
      {
        role: "user",
        content: [documentBlock, { type: "text", text: prompt }],
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    return { ok: false, error: "The model didn't return structured extraction." };
  }

  const raw = toolUse.input as Partial<ContractExtraction>;
  const data: ContractExtraction = {
    deliverables: Array.isArray(raw.deliverables) ? raw.deliverables : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    total_value_cents: typeof raw.total_value_cents === "number" ? raw.total_value_cents : null,
    signed_date: typeof raw.signed_date === "string" ? raw.signed_date : null,
    suggested_title: typeof raw.suggested_title === "string" ? raw.suggested_title : null,
    brand_name: typeof raw.brand_name === "string" ? raw.brand_name : null,
    summary: typeof raw.summary === "string" ? raw.summary : "",
  };

  return { ok: true, data };
}
