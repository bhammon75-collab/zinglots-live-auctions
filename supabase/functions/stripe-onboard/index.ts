import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Polyfill fetch for Stripe in Deno
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, prefer",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, prefer";
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Access-Control-Allow-Headers": reqHeaders } });
  }

  try {
    const { sellerId } = await req.json();
    if (!sellerId) throw new Error("sellerId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://example.com";
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase credentials missing");

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: 'app' } });
    const supabaseAuth = createClient(supabaseUrl, anonKey, { db: { schema: 'app' } });

    // Auth: must be the owner of the seller row (or admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr) return new Response(JSON.stringify({ error: userErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const user = userData.user;

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin && user?.id !== sellerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });

    // Ensure seller exists
    const { data: seller, error: sellerErr } = await supabase
      .from("sellers")
      .select("id, stripe_account_id, kyc_status")
      .eq("id", sellerId)
      .single();
    if (sellerErr) throw new Error(`Seller not found: ${sellerErr.message}`);

    let accountId = seller.stripe_account_id as string | null;
    if (!accountId) {
      const acct = await stripe.accounts.create({ type: "express", capabilities: { transfers: { requested: true } } });
      accountId = acct.id;
      await supabase.from("sellers").update({ stripe_account_id: accountId }).eq("id", sellerId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/dashboard/seller`,
      return_url: `${siteUrl}/dashboard/seller`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url, accountId }), {
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
