"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToAthletes } from "@/lib/push";
import { BRAND_PARTNER_CATEGORIES, type BrandPartnerCategory } from "@/lib/types";

const FROM_ADDRESS = process.env.RESEND_FROM ?? "ACL+ <onboarding@resend.dev>";

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

export interface BrandPartnerInput {
  name: string;
  logo_url: string | null;
  website_url: string;
  offer_headline: string;
  offer_description: string | null;
  discount_code: string;
  category: BrandPartnerCategory;
  is_active: boolean;
  display_order: number;
}

const VALID_CATEGORIES = new Set(BRAND_PARTNER_CATEGORIES.map((c) => c.value));

type ActionResult = { ok: true } | { ok: false; error: string };

// Trim/normalize a payload from the form. Empty strings → null for the
// optional fields so the DB stores NULLs instead of "" (cleaner for
// downstream consumers and for the public-side athlete UI).
function normalize(input: Partial<BrandPartnerInput>): BrandPartnerInput | { error: string } {
  const name = (input.name ?? "").trim();
  const websiteUrl = (input.website_url ?? "").trim();
  const offerHeadline = (input.offer_headline ?? "").trim();
  const discountCode = (input.discount_code ?? "").trim();

  if (!name) return { error: "Brand name is required." };
  if (!websiteUrl) return { error: "Website URL is required." };
  if (!/^https:\/\//i.test(websiteUrl)) return { error: "Website URL must start with https://." };
  if (!offerHeadline) return { error: "Offer headline is required." };
  if (!discountCode) return { error: "Discount code is required." };

  const logoUrl = (input.logo_url ?? "").trim();
  if (logoUrl && !/^https:\/\//i.test(logoUrl)) {
    return { error: "Logo URL must start with https:// (or leave blank)." };
  }

  const order = Number.isFinite(input.display_order) ? Number(input.display_order) : 0;

  const category = (input.category ?? "other") as BrandPartnerCategory;
  if (!VALID_CATEGORIES.has(category)) {
    return { error: "Invalid category." };
  }

  return {
    name,
    logo_url: logoUrl || null,
    website_url: websiteUrl,
    offer_headline: offerHeadline,
    offer_description: (input.offer_description ?? "").trim() || null,
    discount_code: discountCode,
    category,
    is_active: input.is_active ?? true,
    display_order: order,
  };
}

export async function createBrandPartner(input: Partial<BrandPartnerInput>): Promise<ActionResult> {
  await requireAdmin();
  const normalized = normalize(input);
  if ("error" in normalized) return { ok: false, error: normalized.error };

  const admin = createAdminClient();
  const { error } = await admin.from("brand_partners").insert(normalized);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/brand-partners");
  revalidatePath("/vault");
  return { ok: true };
}

export async function updateBrandPartner(
  id: string,
  input: Partial<BrandPartnerInput>,
): Promise<ActionResult> {
  await requireAdmin();
  const normalized = normalize(input);
  if ("error" in normalized) return { ok: false, error: normalized.error };

  const admin = createAdminClient();
  const { error } = await admin.from("brand_partners").update(normalized).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/brand-partners");
  revalidatePath("/vault");
  return { ok: true };
}

export async function toggleBrandPartnerActive(id: string, next: boolean): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("brand_partners").update({ is_active: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/brand-partners");
  revalidatePath("/vault");
  return { ok: true };
}

export async function sendBrandDropEmail(
  brandId: string,
): Promise<
  | { ok: true; sent: number; alreadySent: number; optedOut: number }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: brand } = await admin
    .from("brand_partners")
    .select("id, name, offer_headline, is_active")
    .eq("id", brandId)
    .single();
  if (!brand) return { ok: false, error: "Brand not found." };
  if (!brand.is_active) {
    return { ok: false, error: "Activate the brand before emailing athletes." };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "Email service not configured." };

  // All athletes who could in principle receive a drop email.
  const { data: candidates } = await admin
    .from("athletes")
    .select("id, full_name, email, email_brand_drops");
  const all = candidates ?? [];

  const optedIn = all.filter((a) => a.email_brand_drops);
  const optedOut = all.length - optedIn.length;

  // Skip anyone who already received this brand's drop. The unique
  // (brand_partner_id, athlete_id) constraint would catch dupes anyway,
  // but we filter up-front so the API call count matches what's sent.
  const { data: alreadyRows } = await admin
    .from("brand_drop_emails")
    .select("athlete_id")
    .eq("brand_partner_id", brandId);
  const alreadyIds = new Set((alreadyRows ?? []).map((r) => r.athlete_id as string));
  const recipients = optedIn.filter((a) => !alreadyIds.has(a.id as string));
  const alreadySent = optedIn.length - recipients.length;

  if (recipients.length === 0) {
    return { ok: true, sent: 0, alreadySent, optedOut };
  }

  const resend = new Resend(resendKey);
  const vaultUrl = `${appOrigin()}/vault`;
  let sent = 0;
  for (const a of recipients) {
    const text = [
      `${brand.name} just dropped in your ACL+ Brand Vault.`,
      "",
      brand.offer_headline,
      "",
      `Reveal your code: ${vaultUrl}`,
      "",
      "You get 3 reveals each calendar month. New offers drop regularly.",
      "",
      "To stop these emails, head to Settings in ACL+.",
    ].join("\n");
    const { error: sendError } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: a.email as string,
      subject: `New in your Brand Vault: ${brand.name}`,
      text,
    });
    if (sendError) {
      console.error(`Brand drop email failed for ${a.email}:`, sendError);
      continue;
    }
    const { error: insertError } = await admin
      .from("brand_drop_emails")
      .insert({ brand_partner_id: brandId, athlete_id: a.id });
    if (insertError) {
      console.error(`Brand drop tracking insert failed for ${a.email}:`, insertError);
      continue;
    }
    sent += 1;
  }

  // Fire pushes to the same opt-in audience. Push subscriptions are
  // independent of email_brand_drops — if someone wants push but not
  // email (or vice versa), they get the channel they opted into.
  if (recipients.length > 0) {
    void pushToAthletes(
      recipients.map((a) => a.id as string),
      {
        title: `New in your Brand Vault: ${brand.name}`,
        body: brand.offer_headline,
        url: "/vault",
        tag: `brand-drop:${brandId}`,
      },
    );
  }

  revalidatePath("/admin/brand-partners");
  return { ok: true, sent, alreadySent, optedOut };
}

export async function deleteBrandPartner(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  // Reveals reference brand_partners with ON DELETE CASCADE, so deleting a
  // brand wipes its reveal history. Prefer toggleActive(false) to preserve
  // attribution; this exists for hard removal of test rows.
  const { error } = await admin.from("brand_partners").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/brand-partners");
  revalidatePath("/vault");
  return { ok: true };
}
