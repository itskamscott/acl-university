"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";

// Seeds a tiny set of obviously-labelled example rows so a brand-new
// athlete can poke at populated screens before committing real data.
// Idempotent in the sense that it skips entirely if the athlete already
// has any brands — we never want to dupe or stomp real work.
export async function seedSampleData(): Promise<
  { ok: true; brands: number; content: number } | { ok: false; error: string }
> {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { count: existingBrands } = await supabase
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", athlete.id);
  if ((existingBrands ?? 0) > 0) {
    return { ok: false, error: "You already have brands — sample data isn't needed." };
  }

  // Each brand picks a different pipeline status so the Pipeline view
  // looks alive immediately. "(sample)" in the name + notes line make
  // these obvious to delete later.
  const sampleBrands = [
    {
      athlete_id: athlete.id,
      business_name: "Main Street Pizza (sample)",
      category: "restaurant" as const,
      city: athlete.school ? athlete.school.split(" ")[0] : "Manhattan",
      state: "KS",
      status: "prospect" as const,
      notes: "Sample brand — delete or edit when you're ready.",
    },
    {
      athlete_id: athlete.id,
      business_name: "Iron Gym Co. (sample)",
      category: "fitness" as const,
      city: athlete.school ? athlete.school.split(" ")[0] : "Manhattan",
      state: "KS",
      status: "contacted" as const,
      notes: "Sample brand — delete or edit when you're ready.",
    },
    {
      athlete_id: athlete.id,
      business_name: "Cornerstone Coffee (sample)",
      category: "restaurant" as const,
      city: athlete.school ? athlete.school.split(" ")[0] : "Manhattan",
      state: "KS",
      status: "negotiating" as const,
      notes: "Sample brand — delete or edit when you're ready.",
    },
  ];

  const { error: brandsError } = await supabase.from("brands").insert(sampleBrands);
  if (brandsError) return { ok: false, error: brandsError.message };

  const { error: contentError } = await supabase.from("content_posts").insert({
    athlete_id: athlete.id,
    platform: "instagram",
    status: "idea",
    title: "Gameday Reel idea (sample)",
    notes: "Sample post — try drafting the caption with the AI Assistant, then delete.",
  });
  if (contentError) {
    // The brands already landed; we don't roll those back. Caller sees
    // partial success but the count of content will be zero.
    return { ok: true, brands: sampleBrands.length, content: 0 };
  }

  revalidatePath("/dashboard");
  revalidatePath("/brands");
  revalidatePath("/content");
  return { ok: true, brands: sampleBrands.length, content: 1 };
}
