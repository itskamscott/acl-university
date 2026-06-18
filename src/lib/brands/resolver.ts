import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandStatus } from "@/lib/types";

interface ResolveResult {
  id: string;
  created: boolean;
  business_name: string;
}

interface ResolveOptions {
  statusOnCreate?: BrandStatus;
}

/**
 * Look up a brand by name (case-insensitive, exact) for the given athlete,
 * or create a new prospect-style record if none exists. Works equally with
 * the user-session client and the service-role admin client — RLS allows
 * each from their own context.
 */
export async function findOrCreateBrand(
  client: SupabaseClient,
  athleteId: string,
  rawName: string,
  options: ResolveOptions = {},
): Promise<{ ok: true; brand: ResolveResult } | { ok: false; error: string }> {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Brand name is required." };

  const { data: existing } = await client
    .from("brands")
    .select("id, business_name")
    .eq("athlete_id", athleteId)
    .is("archived_at", null)
    .ilike("business_name", name)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      brand: {
        id: existing.id as string,
        business_name: existing.business_name as string,
        created: false,
      },
    };
  }

  const { data: created, error } = await client
    .from("brands")
    .insert({
      athlete_id: athleteId,
      business_name: name,
      category: "other",
      status: options.statusOnCreate ?? "negotiating",
    })
    .select("id, business_name")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Couldn't create brand." };
  }

  return {
    ok: true,
    brand: {
      id: created.id as string,
      business_name: created.business_name as string,
      created: true,
    },
  };
}
