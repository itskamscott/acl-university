import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { assertTeamAccess } from "@/lib/access-check";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5";
const IDEAS_PER_ATHLETE = 3;
const MAX_ATHLETES_PER_BATCH = 25; // keep prompt sane

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface IdeaJSON {
  platform: "instagram" | "tiktok" | "youtube" | "x" | "other";
  headline: string;
  body: string;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Spec §6 — verify access in code before running analysis.
  const access = await assertTeamAccess(supabase, teamId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { team } = access;

  // Pull athletes via the RLS-respecting client (extra defense in depth on
  // top of the access check above). For now we cap the batch so a 500-
  // person team doesn't blow the context window.
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, full_name, sport, school, graduation_year, instagram_handle")
    .eq("team_id", teamId)
    .order("full_name", { ascending: true })
    .limit(MAX_ATHLETES_PER_BATCH);

  if (!athletes || athletes.length === 0) {
    return NextResponse.json({ ok: true, team: { id: team.id, name: team.name }, results: [] });
  }

  const promptAthletes = athletes.map((a) => ({
    id: a.id,
    name: a.full_name,
    sport: a.sport ?? team.sport ?? "athlete",
    year: a.graduation_year ?? undefined,
    handle: a.instagram_handle ?? undefined,
  }));

  const systemPrompt = [
    "You are a content strategist working with college athletes' personal brands.",
    "For each athlete you're given, suggest content ideas tailored to their sport, school year, and any social handle context.",
    "Mix platforms — instagram, tiktok, youtube — based on what fits.",
    "Output STRICT JSON. No prose outside the JSON.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    instructions: `For each athlete, generate exactly ${IDEAS_PER_ATHLETE} content ideas. Each idea must include platform (one of: instagram, tiktok, youtube, x, other), a short headline (under 60 chars), and a body (under 200 chars) explaining the idea and why it'll resonate.`,
    output_shape: {
      results: [
        {
          athlete_id: "<uuid>",
          ideas: [{ platform: "<string>", headline: "<string>", body: "<string>" }],
        },
      ],
    },
    team: { name: team.name, sport: team.sport },
    athletes: promptAthletes,
  });

  let payload: { results: Array<{ athlete_id: string; ideas: IdeaJSON[] }> } | null = null;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      payload = parseJson(textBlock.text);
    }
  } catch (err) {
    console.error("content-ideas anthropic error:", err);
    return NextResponse.json(
      { error: "Idea generation failed. Try again." },
      { status: 502 },
    );
  }

  if (!payload || !Array.isArray(payload.results)) {
    return NextResponse.json(
      { error: "Model returned no usable ideas." },
      { status: 502 },
    );
  }

  // Stitch athlete names back in. Filter to athletes that were in the batch.
  const byId = new Map(athletes.map((a) => [a.id, a]));
  const results = payload.results
    .filter((r) => byId.has(r.athlete_id))
    .map((r) => {
      const athlete = byId.get(r.athlete_id)!;
      return {
        athlete_id: r.athlete_id,
        athlete_name: athlete.full_name,
        ideas: (r.ideas ?? []).slice(0, IDEAS_PER_ATHLETE).map((i) => ({
          platform: ALLOWED_PLATFORMS.has(i.platform) ? i.platform : "other",
          headline: String(i.headline ?? "").slice(0, 80),
          body: String(i.body ?? "").slice(0, 300),
        })),
      };
    });

  return NextResponse.json({
    ok: true,
    team: { id: team.id, name: team.name },
    results,
  });
}

const ALLOWED_PLATFORMS = new Set<IdeaJSON["platform"]>([
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "other",
]);

// Try to parse JSON tolerantly — the model occasionally wraps in markdown
// code fences even when told not to.
function parseJson(text: string): { results: Array<{ athlete_id: string; ideas: IdeaJSON[] }> } | null {
  const candidates = [text, stripFence(text), extractObject(text)].filter(
    (s): s is string => Boolean(s),
  );
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c);
      if (obj && Array.isArray(obj.results)) {
        return obj as { results: Array<{ athlete_id: string; ideas: IdeaJSON[] }> };
      }
    } catch {
      // keep trying
    }
  }
  return null;
}

function stripFence(s: string): string | null {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}
function extractObject(s: string): string | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}
