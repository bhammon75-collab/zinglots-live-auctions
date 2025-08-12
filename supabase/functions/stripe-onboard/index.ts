import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Stripe needs fetch in Deno
import Stripe from "https://esm.sh/stripe@14.21.0";

// CORS headers required on ALL responses
const baseCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...baseCorsHeaders, ...extraHeaders },
  });

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    const requested = req.headers.get("Access-Control-Request-Headers") || baseCorsHeaders["Access-Control-Allow-Headers"];
    return new Response(null, {
      status: 200,
      headers: { ...baseCorsHeaders, "Access-Control-Allow-Headers": requested, "Access-Control-Max-Age": "86400" },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const siteUrl = Deno.env.get("SITE_URL");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!siteUrl) throw new Error("SITE_URL is not set");

    let payload: any = {};
    try {
      payload = await req.json();
    } catch (_) {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { sellerId } = payload || {};
    if (!sellerId || typeof sellerId !== "string") {
      return json({ error: "sellerId is required (string)" }, 400);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    console.log("[stripe-onboard] Creating express account for seller", sellerId);
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { sellerId },
    });

    console.log("[stripe-onboard] Creating account link", account.id);
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: siteUrl,
      return_url: siteUrl,
      type: "account_onboarding",
    });

    return json({ url: link.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-onboard] ERROR", message);
    return json({ error: message }, 400);
  }
});
