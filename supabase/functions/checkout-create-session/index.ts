import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId, amountCents, feeBps, successUrl, cancelUrl } = await req.json();
    if (!orderId || !amountCents) throw new Error("orderId and amountCents are required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://example.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "ZingLots Order" },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl || `${siteUrl}/success?order=${orderId}`,
      cancel_url: cancelUrl || `${siteUrl}/cancel?order=${orderId}`,
      metadata: {
        orderId,
        feeBps: String(feeBps ?? Deno.env.get("STRIPE_PLATFORM_FEE_BPS") ?? 1200),
      },
    });

    return new Response(JSON.stringify({ id: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
