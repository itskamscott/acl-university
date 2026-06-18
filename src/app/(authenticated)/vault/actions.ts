"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RevealError =
  | "not_authenticated"
  | "athlete_not_found"
  | "brand_inactive_or_missing"
  | "profile_incomplete"
  | "monthly_cap_reached"
  | "unknown";

export interface RevealSuccess {
  ok: true;
  status: "new" | "existing";
  discount_code: string;
  reveals_used_this_month: number;
  reveals_cap: number;
}

export interface RevealFailure {
  ok: false;
  error: RevealError;
  message: string;
}

export type RevealResult = RevealSuccess | RevealFailure;

// Map Postgres error codes raised by reveal_brand_code RPC → typed errors.
// Anything else is reported as 'unknown' so callers don't have to special-case
// raw Postgres messages.
function mapRpcError(code: string | null, message: string): RevealFailure {
  switch (code) {
    case "P0001":
      return { ok: false, error: "athlete_not_found", message: "Athlete profile not found." };
    case "P0002":
      return { ok: false, error: "brand_inactive_or_missing", message: "This offer is no longer available." };
    case "P0003":
      return { ok: false, error: "profile_incomplete", message: "Complete your profile to unlock the vault." };
    case "P0004":
      return { ok: false, error: "monthly_cap_reached", message: "You've used your 3 reveals this month." };
    default:
      return { ok: false, error: "unknown", message: message || "Couldn't reveal this code. Try again." };
  }
}

export async function revealBrandCode(brandPartnerId: string): Promise<RevealResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_authenticated", message: "Sign in and try again." };
  }

  const { data, error } = await supabase
    .rpc("reveal_brand_code", { p_brand_partner_id: brandPartnerId })
    .single();

  if (error) {
    // Supabase exposes the underlying Postgres SQLSTATE on `error.code`.
    return mapRpcError(error.code ?? null, error.message);
  }

  type RpcRow = {
    status: "new" | "existing";
    discount_code: string;
    reveal_id: string;
    reveals_used_this_month: number;
    reveals_cap: number;
  };
  const row = data as RpcRow | null;
  if (!row) {
    return { ok: false, error: "unknown", message: "Couldn't reveal this code. Try again." };
  }

  // Refresh server-rendered counters/cards on the page after a successful new reveal.
  if (row.status === "new") {
    revalidatePath("/vault");
  }

  return {
    ok: true,
    status: row.status,
    discount_code: row.discount_code,
    reveals_used_this_month: row.reveals_used_this_month,
    reveals_cap: row.reveals_cap,
  };
}
