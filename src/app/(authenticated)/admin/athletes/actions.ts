"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";

export async function grantCredits(
  athleteId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string; balance?: number }> {
  await requireAdmin();
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be a positive integer." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_credits", {
    p_athlete_id: athleteId,
    p_amount: amount,
    p_reason: "admin_grant",
    p_metadata: null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/athletes");
  return { ok: true, balance: data as number };
}
