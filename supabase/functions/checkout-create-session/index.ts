import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId, amountCents, feeBps, successUrl, cancelUrl } = await req.json();
    if (!orderId || !amountCents) throw new Error("orderId and amountCents are required");

    // Auth: must be the buyer of the order
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, db: { schema: 'app' } });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: 'app' } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr) return new Response(JSON.stringify({ error: userErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });

    const { data: order, error: oErr } = await supabaseAdmin.from('orders').select('id, buyer_id').eq('id', orderId).single();
    if (oErr) return new Response(JSON.stringify({ error: `Order not found: ${oErr.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
    if (order.buyer_id !== userData.user?.id) return new Response(JSON.stringify({ error: "Forbidden" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });

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
