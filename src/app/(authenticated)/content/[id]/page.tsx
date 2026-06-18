import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { ContentDetailClient } from "./content-detail-client";
import type { ContentPost, Brand } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select("title, caption")
    .eq("id", id)
    .maybeSingle();
  const display = data?.title || (data?.caption ? data.caption.slice(0, 40) : "Post");
  return { title: display };
}

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("content_posts")
    .select("*, brands(id, business_name)")
    .eq("id", id)
    .eq("athlete_id", athlete.id)
    .single();

  if (!post) notFound();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, business_name")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null)
    .order("business_name", { ascending: true });

  return (
    <ContentDetailClient
      post={post as ContentPost & { brands: { id: string; business_name: string } | null }}
      brands={(brands ?? []) as Pick<Brand, "id" | "business_name">[]}
      athleteId={athlete.id}
    />
  );
}
