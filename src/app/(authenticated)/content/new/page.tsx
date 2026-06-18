import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { NewContentForm } from "./new-content-form";
import type { Brand } from "@/lib/types";

export const metadata = { title: "New Content" };

export default async function NewContentPage() {
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, business_name")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null)
    .order("business_name", { ascending: true });

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href="/content"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Content
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">New Post</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Capture an idea, draft a caption, or schedule something you&apos;re ready to post.
      </p>

      <NewContentForm
        athleteId={athlete.id}
        brands={(brands ?? []) as Pick<Brand, "id" | "business_name">[]}
      />
    </div>
  );
}
