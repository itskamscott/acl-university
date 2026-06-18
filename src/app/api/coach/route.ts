import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt } from "@/lib/coach/system-prompt";
import { COACH_TOOLS, executeTool } from "@/lib/coach/tools";
import Anthropic from "@anthropic-ai/sdk";
import type { Athlete, Brand } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_TOOL_ROUNDS = 5;
const MAX_ATTACHMENTS_PER_MESSAGE = 4;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_PDF_TYPE = "application/pdf";

type AnthropicImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// Inline-sentinel format for piping celebration events through the chat
// text stream. The bytes \x00WIN:...\x00 never appear in normal model
// output, so the client can strip them out and dispatch the win modal.
interface StreamedWin {
  kind: "deal_closed" | "content_posted" | "contract_signed" | "contract_completed" | "payment_received";
  subject: string;
  postedUrl?: string;
}

function winFromToolUse(name: string, input: Record<string, unknown>): StreamedWin | null {
  if (name === "update_brand_status" && input.new_status === "deal_closed") {
    return { kind: "deal_closed", subject: String(input.business_name ?? "this brand") };
  }
  if (name === "update_content_status" && input.new_status === "posted") {
    return {
      kind: "content_posted",
      subject: typeof input.match === "string" ? input.match : "",
      postedUrl: typeof input.posted_url === "string" ? input.posted_url : undefined,
    };
  }
  if (name === "create_contract") {
    const status = String(input.status ?? "draft");
    const signed = !!input.signed_at;
    const title = String(input.title ?? "");
    if (status === "completed") return { kind: "contract_completed", subject: title };
    if (status === "active" || signed) return { kind: "contract_signed", subject: title };
  }
  if (name === "add_payment" && input.received === true) {
    const cents = typeof input.amount_cents === "number" ? input.amount_cents : 0;
    const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    return { kind: "payment_received", subject: `$${dollars}` };
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!athlete) {
    return Response.json({ error: "Athlete not found" }, { status: 404 });
  }

  const body = await request.json();
  const message = typeof body?.message === "string" ? body.message : "";
  const imagePaths: string[] = Array.isArray(body?.image_paths)
    ? body.image_paths
        .filter((p: unknown): p is string => typeof p === "string")
        // Defense in depth: only paths inside the caller's own folder are
        // accepted, even though service-role downloads bypass storage RLS.
        .filter((p: string) => p.startsWith(`${athlete.id}/`))
        .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    : [];

  // Thread id is always supplied by the client (the page hydrates it
  // from the latest thread on load; "New chat" mints a fresh one).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const threadId: string | null =
    typeof body?.thread_id === "string" && UUID_RE.test(body.thread_id)
      ? body.thread_id
      : null;
  if (!threadId) {
    return Response.json({ error: "Missing or invalid thread_id" }, { status: 400 });
  }

  if (!message.trim() && imagePaths.length === 0) {
    return Response.json({ error: "Message or attachment is required" }, { status: 400 });
  }

  // Rate limit: max 5 user messages per rolling 60 seconds per athlete.
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabase
    .from("coach_messages")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", athlete.id)
    .eq("role", "user")
    .gte("created_at", sinceIso);
  if ((recentCount ?? 0) >= 5) {
    return Response.json(
      { error: "You're sending messages really fast — give the AI Assistant a minute to breathe." },
      { status: 429 },
    );
  }

  // Consume one credit atomically. Returns null if the athlete is out.
  const admin = createAdminClient();
  const { data: remainingCredits, error: creditError } = await admin.rpc(
    "consume_credit",
    { p_athlete_id: athlete.id, p_reason: "coach_message" },
  );

  if (creditError) {
    console.error("consume_credit error:", creditError);
    return Response.json(
      { error: "Couldn't check your credit balance. Try again." },
      { status: 500 },
    );
  }

  if (remainingCredits === null) {
    return Response.json(
      {
        error: "You're out of credits. Buy more from Settings to keep chatting.",
        code: "insufficient_credits",
      },
      { status: 402 },
    );
  }

  // Save user message (with image refs if any).
  await supabase.from("coach_messages").insert({
    athlete_id: athlete.id,
    role: "user",
    content: message,
    image_paths: imagePaths,
    thread_id: threadId,
  });

  // Load the last 20 stored messages for THIS THREAD only. Past threads
  // are walled off so a "New chat" press genuinely resets the model's
  // working context (and token cost), even though the rows stay in DB.
  const { data: history } = await supabase
    .from("coach_messages")
    .select("role, content, image_paths")
    .eq("athlete_id", athlete.id)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(20);

  const reversed = (history || []).reverse();

  // Anthropic requires strict user/assistant alternation and rejects
  // empty content. If a turn errored mid-stream we may have a user
  // message with no following assistant — we synthesize a one-line
  // assistant placeholder so the next turn's history stays valid.
  type RawMsg = { role: string; content: string; image_paths: string[] };
  const safe: RawMsg[] = [];
  for (const raw of reversed) {
    const msg: RawMsg = {
      role: raw.role,
      content: raw.content ?? "",
      image_paths: (raw.image_paths ?? []) as string[],
    };
    const prev = safe[safe.length - 1];
    if (prev && prev.role === msg.role) {
      safe.push({
        role: msg.role === "user" ? "assistant" : "user",
        content: msg.role === "user"
          ? "[earlier reply didn't go through]"
          : "[continue]",
        image_paths: [],
      });
    }
    safe.push(msg);
  }

  const conversationHistory: Anthropic.Messages.MessageParam[] = await Promise.all(
    safe.map(async (msg, idx) => {
      const isCurrent = idx === safe.length - 1;
      const hasImages = isCurrent && msg.role === "user" && msg.image_paths.length > 0;

      if (!hasImages) {
        // Empty content (e.g. an image-only message in past history) is
        // rejected by the API, so substitute a placeholder.
        const fallback = msg.image_paths.length > 0 ? "[image attached]" : "(no message)";
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content.trim() ? msg.content : fallback,
        };
      }

      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      for (const path of msg.image_paths) {
        const { data, error } = await admin.storage
          .from("assistant-uploads")
          .download(path);
        if (error || !data) continue;
        const detectedType = data.type || "image/jpeg";
        const buf = await data.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        if (ALLOWED_IMAGE_TYPES.has(detectedType)) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: detectedType as AnthropicImageMediaType,
              data: base64,
            },
          });
        } else if (detectedType === ALLOWED_PDF_TYPE) {
          blocks.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          });
        }
      }
      if (msg.content) blocks.push({ type: "text", text: msg.content });
      if (blocks.length === 0) {
        blocks.push({ type: "text", text: "[attachment couldn't be loaded]" });
      }
      return { role: "user" as const, content: blocks };
    }),
  );

  // Active-brand CRM context for the system prompt.
  const { data: brands } = await supabase
    .from("brands")
    .select("business_name, status, category, city, state, next_followup_date, contact_name, notes")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);

  const systemPrompt = buildSystemPrompt(athlete as Athlete, {
    brands: (brands || []) as Brand[],
  });

  const encoder = new TextEncoder();
  const messages: Anthropic.Messages.MessageParam[] = [...conversationHistory];
  let fullText = "";

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-5",
            max_tokens: 1024,
            system: systemPrompt,
            tools: COACH_TOOLS,
            messages,
          });

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          const finalMessage = await stream.finalMessage();

          if (finalMessage.stop_reason !== "tool_use") break;

          // Execute every tool_use block in parallel, preserving order.
          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
          );
          const executed = await Promise.all(
            toolUseBlocks.map((block) =>
              executeTool(
                block.name,
                block.input as Record<string, unknown>,
                { athleteId: athlete.id, supabase: admin },
              ).then((content) => ({ block, content })),
            ),
          );

          const results = executed.map(({ block, content }) => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content,
          }));

          // Emit celebration sentinels for any successful win-worthy tool
          // call. Errors come back from executeTool prefixed with "Error: "
          // so we skip those.
          for (const { block, content } of executed) {
            if (content.startsWith("Error: ")) continue;
            const win = winFromToolUse(
              block.name,
              block.input as Record<string, unknown>,
            );
            if (win) {
              controller.enqueue(encoder.encode(`\x00WIN:${JSON.stringify(win)}\x00`));
            }
          }

          messages.push({ role: "assistant", content: finalMessage.content });
          messages.push({ role: "user", content: results });
        }

        if (fullText) {
          await supabase.from("coach_messages").insert({
            athlete_id: athlete.id,
            role: "assistant",
            content: fullText,
            thread_id: threadId,
          });
        }
        controller.close();
      } catch (err) {
        console.error("Coach stream error:", err);
        const errorText = "[Something went wrong with the AI Assistant. Try again.]";
        controller.enqueue(encoder.encode("\n\n" + errorText));
        // Persist a placeholder so the next turn's alternation isn't broken
        // by a missing assistant message after the failed user message.
        try {
          await supabase.from("coach_messages").insert({
            athlete_id: athlete.id,
            role: "assistant",
            content: fullText || errorText,
            thread_id: threadId,
          });
        } catch (insertErr) {
          console.error("Failed to save error placeholder:", insertErr);
        }
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
