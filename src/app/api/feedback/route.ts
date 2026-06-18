import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FeedbackType } from "@/lib/types";

const SUPPORT_EMAIL = process.env.FEEDBACK_TO_EMAIL ?? "support@athletecreatorlab.com";
const FROM_ADDRESS = process.env.RESEND_FROM ?? "ACL+ Feedback <onboarding@resend.dev>";

const ALLOWED_TYPES: FeedbackType[] = ["bug", "feature", "other"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .single();

  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type as FeedbackType | undefined;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: "Tell us a little more." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Keep it under 5000 characters." }, { status: 400 });
  }

  // Try email first so we can record whether it succeeded.
  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const typeLabel = type === "bug" ? "Bug" : type === "feature" ? "Feature request" : "Feedback";
      const { error: emailError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: SUPPORT_EMAIL,
        replyTo: athlete.email,
        subject: `[ACL+ ${typeLabel}] ${athlete.full_name}`,
        text: [
          `Type: ${typeLabel}`,
          `From: ${athlete.full_name} <${athlete.email}>`,
          `Athlete ID: ${athlete.id}`,
          "",
          message,
        ].join("\n"),
      });
      if (emailError) {
        console.error("Resend error:", emailError);
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.error("Resend send failed:", err);
    }
  } else {
    console.warn("RESEND_API_KEY not set — feedback email not sent.");
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("feedback").insert({
    athlete_id: athlete.id,
    athlete_email: athlete.email,
    athlete_name: athlete.full_name,
    type,
    message,
    email_sent: emailSent,
  });

  if (insertError) {
    console.error("Feedback insert failed:", insertError);
    return NextResponse.json({ error: "Couldn't save feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, emailSent });
}
