import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { NewContractForm } from "./new-contract-form";
import type { Brand } from "@/lib/types";

export const metadata = { title: "New Contract" };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandIdParam } = await searchParams;
  const { athlete } = await getAthleteOrRedirect();
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, business_name")
    .eq("athlete_id", athlete.id)
    .is("archived_at", null)
    .order("business_name", { ascending: true });

  let initialBrandName: string | undefined;
  if (brandIdParam) {
    const match = (brands ?? []).find((b) => b.id === brandIdParam);
    initialBrandName = match?.business_name;
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contracts
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">New Contract</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Three ways to get started.
      </p>

      <NewContractForm
        athleteId={athlete.id}
        brands={(brands ?? []) as Pick<Brand, "id" | "business_name">[]}
        initialBrandName={initialBrandName}
      />
    </div>
  );
}
