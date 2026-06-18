"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/get-athlete";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FROM_ADDRESS = process.env.RESEND_FROM ?? "ACL+ <onboarding@resend.dev>";

function randomSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function generateCode(): string {
  return `ACL-${randomSegment(4)}-${randomSegment(4)}`;
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

async function insertUniqueCode(
  invitedEmail: string | null,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await admin
      .from("invite_codes")
      .insert({ code, invited_email: invitedEmail });
    if (!error) return { ok: true, code };
    if (error.code !== "23505") return { ok: false, error: error.message };
  }
  return { ok: false, error: "Couldn't generate a unique code. Try again." };
}

export async function createInviteCode(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  await requireAdmin();
  const result = await insertUniqueCode(null);
  if (result.ok) revalidatePath("/admin/invites");
  return result;
}

export async function inviteByEmail(
  emailRaw: string,
): Promise<{ ok: true; code: string; emailSent: boolean } | { ok: false; error: string }> {
  await requireAdmin();

  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("invite_codes")
    .select("code")
    .eq("invited_email", email)
    .is("used_by", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: `An unused invite is already out for ${email} (${existing.code}). Revoke it first if you want to re-send.`,
    };
  }

  const insert = await insertUniqueCode(email);
  if (!insert.ok) return insert;

  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const signupUrl = `${appOrigin()}/signup?code=${encodeURIComponent(insert.code)}`;
      const { error: sendError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: "You're invited to ACL+",
        text: [
          "You've been invited to ACL+, the brand CRM and AI Assistant from Athlete Creator Lab.",
          "",
          `Your invite code: ${insert.code}`,
          "",
          `Get started: ${signupUrl}`,
          "",
          "This code is single-use — save it somewhere until you finish signing up.",
        ].join("\n"),
      });
      emailSent = !sendError;
      if (sendError) console.error("Invite email error:", sendError);
    } catch (err) {
      console.error("Invite email send failed:", err);
    }
  }

  revalidatePath("/admin/invites");
  return { ok: true, code: insert.code, emailSent };
}

export async function resendInviteEmail(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invite_codes")
    .select("code, invited_email, used_by")
    .eq("id", id)
    .maybeSingle();

  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.used_by) {
    return { ok: false, error: "Already claimed — nothing to resend." };
  }
  if (!invite.invited_email) {
    return { ok: false, error: "This invite has no email attached." };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "Email service not configured." };

  try {
    const resend = new Resend(resendKey);
    const signupUrl = `${appOrigin()}/signup?code=${encodeURIComponent(invite.code)}`;
    const { error: sendError } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: invite.invited_email,
      subject: "Reminder: your ACL+ invite",
      text: [
        "Quick reminder — you've been invited to ACL+, the brand CRM and AI Assistant from Athlete Creator Lab.",
        "",
        `Your invite code: ${invite.code}`,
        "",
        `Get started: ${signupUrl}`,
        "",
        "This code is single-use — save it somewhere until you finish signing up.",
      ].join("\n"),
    });
    if (sendError) {
      console.error("Resend invite email error:", sendError);
      return { ok: false, error: "Email failed to send. Try again." };
    }
  } catch (err) {
    console.error("Resend invite email send failed:", err);
    return { ok: false, error: "Email failed to send. Try again." };
  }

  return { ok: true };
}

export async function revokeInviteCode(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("invite_codes").delete().eq("id", id).is("used_by", null);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/invites");
  return { ok: true };
}
