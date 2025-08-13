import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId, successUrl, cancelUrl } = await req.json();
    if (!orderId) throw new Error("orderId is required");

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

    const { data: order, error: oErr } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, subtotal, fees_bps, shipping_cents, shipping_flat_cents, fee_applies_to_shipping')
      .eq('id', orderId)
      .single();
    if (oErr) return new Response(JSON.stringify({ error: `Order not found: ${oErr.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
    if (order.buyer_id !== userData.user?.id) return new Response(JSON.stringify({ error: "Forbidden" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });

    const subtotalCents = Math.round(Number(order.subtotal) * 100);
    const snapshotShipping = Number(order.shipping_flat_cents || 0);
    const legacyShipping = Number(order.shipping_cents || 0);
    const shippingCents = snapshotShipping > 0 ? snapshotShipping : legacyShipping;

    const feeBps = Number(Deno.env.get('STRIPE_PLATFORM_FEE_BPS') || order.fees_bps || 1200);
    const feeIncludesShipping = order.fee_applies_to_shipping !== false; // default true
    const feeBase = subtotalCents + (feeIncludesShipping ? shippingCents : 0);
    const platformFeeCents = Math.round((feeBase * feeBps) / 10000);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://example.com";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "ZingLots Order" },
          unit_amount: subtotalCents,
        },
        quantity: 1,
      },
    ];
    if (shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping' },
          unit_amount: shippingCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl || `${siteUrl}/success?order=${orderId}`,
      cancel_url: cancelUrl || `${siteUrl}/cancel?order=${orderId}`,
      metadata: {
        orderId,
        subtotalCents: String(subtotalCents),
        shippingCents: String(shippingCents),
        platformFeeCents: String(platformFeeCents),
      },
      payment_intent_data: {
        transfer_group: `order_${orderId}`,
      },
    });

    return new Response(JSON.stringify({ id: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
