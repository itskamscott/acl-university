"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { seedSampleData } from "./seed-action";

export function SeedSampleButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { notify } = useToast();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await seedSampleData();
          if (!result.ok) {
            notify(result.error, "error");
            return;
          }
          notify(`Added ${result.brands} sample brands.`, "success");
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-acl-blue hover:underline disabled:opacity-50"
    >
      <Sparkles className="h-3 w-3" />
      {pending ? "Adding…" : "or load sample brands to explore"}
    </button>
  );
}
