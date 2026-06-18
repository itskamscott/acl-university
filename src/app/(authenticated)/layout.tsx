import { AppShell } from "@/components/app-shell";
import { CoachPanel } from "@/components/coach-panel";
import { ToastProvider } from "@/components/toast-provider";
import { CreditsProvider } from "@/components/credits-provider";
import { CommandPalette } from "@/components/command-palette";
import { InstallPrompt } from "@/components/install-prompt";
import { ScrollToTop } from "@/components/scroll-to-top";
import { WinCelebrationProvider } from "@/components/win-celebration";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";
import { getAthleteOrRedirect, getAthleteTeamContext } from "@/lib/get-athlete";
import { createClient } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { athlete } = await getAthleteOrRedirect();
  const teamContext = await getAthleteTeamContext();
  const supabase = await createClient();

  // Brand-Vault-gating fields. Order matters — we render them in the
  // same order in the banner copy.
  const missingProfileFields: string[] = [];
  if (!athlete.full_name?.trim()) missingProfileFields.push("full name");
  if (!athlete.sport?.trim()) missingProfileFields.push("sport");
  if (!athlete.school?.trim()) missingProfileFields.push("school");
  if (!athlete.instagram_handle?.trim()) missingProfileFields.push("Instagram handle");
  if (!athlete.shipping_address?.trim()) missingProfileFields.push("shipping address");

  // Count active brand_partners added since the athlete last opened /vault.
  // RLS on brand_partners already filters to active rows for authenticated
  // athletes, so the count matches what they'd actually see in the vault.
  const { count } = await supabase
    .from("brand_partners")
    .select("id", { count: "exact", head: true })
    .gt("created_at", athlete.last_seen_vault_at);
  const newVaultCount = count ?? 0;

  return (
    <ToastProvider>
      <CreditsProvider initial={athlete.credits}>
        <AppShell
          isAdmin={athlete.is_admin}
          tier={athlete.tier}
          newVaultCount={newVaultCount}
          teamContext={teamContext}
        >
          <ScrollToTop />
          <ProfileCompletionBanner missing={missingProfileFields} />
          {children}
          <CoachPanel />
          <CommandPalette />
          <InstallPrompt />
          <WinCelebrationProvider />
        </AppShell>
      </CreditsProvider>
    </ToastProvider>
  );
}
