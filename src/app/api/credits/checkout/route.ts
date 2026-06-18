import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getTier } from "@/lib/credit-tiers";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, email")
    .eq("auth_user_id", user.id)
    .single();

  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  const { tierId } = await request.json().catch(() => ({ tierId: null }));
  const tier = getTier(tierId);
  if (!tier) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Payments aren't configured yet." },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: athlete.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: tier.priceCents,
          product_data: {
            name: `${tier.credits} AI Assistant credits`,
            description: `${tier.label} pack`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      athlete_id: athlete.id,
      credits: String(tier.credits),
      tier_id: tier.id,
    },
    success_url: `${origin}/settings?purchase=success#credits`,
    cancel_url: `${origin}/settings?purchase=cancelled#credits`,
  });

  return NextResponse.json({ url: session.url });
}
