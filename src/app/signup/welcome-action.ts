"use server";

import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM ?? "ACL+ <onboarding@resend.dev>";

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

// Fire-and-forget welcome email. Intentionally returns void and swallows
// errors — a missing welcome shouldn't block signup completion. We don't
// gate this on email verification: most invitees come in already-known
// to ACL via Skool, so the welcome is a separate "here's what to do"
// pass rather than a verification flow.
export async function sendWelcomeEmail(email: string, fullName: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const firstName = fullName.trim().split(/\s+/)[0] || "athlete";

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: "Welcome to ACL+",
      text: [
        `${firstName}, welcome to ACL+.`,
        "",
        "Quick tour of what's inside:",
        "",
        "- Dashboard — start here every day.",
        "- Brand CRM — track every local business you're pursuing.",
        "- AI Assistant — drafts outreach, reads your CRM, files contracts. Snap a photo of a contract or business card and it'll log it.",
        "- Contracts — log deals, track deliverables and payments.",
        "- Content — capture ideas and schedule posts.",
        "- Brand Vault — discount codes from ACL brand partners.",
        "",
        `Open the app: ${appOrigin()}/dashboard`,
        "",
        "Questions or feedback? Hit the feedback button in the bottom-left of the app.",
        "",
        "— Kam & Denzel",
        "  ACL Founders",
      ].join("\n"),
    });
  } catch (err) {
    console.error("Welcome email failed:", err);
  }
}
