import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Polyfill fetch for Stripe in Deno
import Stripe from "https://esm.sh/stripe@14.21.0";

// Strict CORS per requirements
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const siteUrl = Deno.env.get("SITE_URL");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!siteUrl) throw new Error("SITE_URL is not set");

    const { sellerId } = await req.json();
    if (!sellerId || typeof sellerId !== "string") {
      throw new Error("sellerId is required (string)");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create a Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      // Optional: store reference
      metadata: { sellerId },
    });

    // Generate an onboarding account link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/`,
      return_url: `${siteUrl}/`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

