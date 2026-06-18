import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const athleteId = session.metadata?.athlete_id;
    const creditsRaw = session.metadata?.credits;
    const credits = creditsRaw ? parseInt(creditsRaw, 10) : NaN;

    if (!athleteId || !Number.isFinite(credits) || credits <= 0) {
      console.error("Invalid checkout metadata:", session.metadata);
      return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("grant_credits", {
      p_athlete_id: athleteId,
      p_amount: credits,
      p_reason: "stripe_purchase",
      p_metadata: {
        session_id: session.id,
        payment_intent: session.payment_intent,
        amount_total: session.amount_total,
        tier_id: session.metadata?.tier_id,
      },
    });

    if (error) {
      // 23505 = unique violation; our session_id index caught a retry.
      // Treat as success so Stripe stops re-delivering.
      if (error.code === "23505") {
        console.log("Stripe webhook retry for session", session.id, "— already processed");
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("grant_credits failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
