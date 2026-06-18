import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Athlete } from "@/lib/types";

export const getAthleteOrRedirect = cache(
  async (): Promise<{ athlete: Athlete; userId: string }> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: athlete } = await supabase
      .from("athletes")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    if (!athlete) {
      redirect("/login");
    }

    return { athlete: athlete as Athlete, userId: user.id };
  },
);

export const requireAdmin = cache(async (): Promise<Athlete> => {
  const { athlete } = await getAthleteOrRedirect();
  if (!athlete.is_admin) {
    redirect("/dashboard");
  }
  return athlete;
});
