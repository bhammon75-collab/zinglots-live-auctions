import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept-profile",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false }, db: { schema: 'app' } }
  );

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig || !webhookSecret) throw new Error("Missing webhook signature or secret");
    const payload = await req.text();
    const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId as string | undefined;
      if (orderId) {
        // Fetch order
        const { data: order, error: oErr } = await supabase
          .from("orders")
          .select("id, subtotal, fees_bps, shipping_cents, lot_id")
          .eq("id", orderId)
          .single();
        if (oErr) throw new Error(`Order fetch error: ${oErr.message}`);

        // Prefer cents from metadata to avoid rounding issues
        const totalCents = Number(session.metadata?.totalCents || Math.round(Number(order.subtotal) * 100) + Number(order.shipping_cents || 0));
        const platformFeeCents = Number(session.metadata?.platformFeeCents || Math.round((totalCents * Number(order.fees_bps || 1200)) / 10000));
        const sellerCents = Math.max(0, totalCents - platformFeeCents);

        await supabase.from("orders").update({
          status: 'paid',
          stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
        }).eq("id", orderId);

        // Find seller for this lot
        const { data: lot, error: lErr } = await supabase
          .from('lots')
          .select('show_id')
          .eq('id', order.lot_id)
          .single();
        if (lErr) throw new Error(`Lot fetch error: ${lErr.message}`);
        const { data: show, error: sErr } = await supabase
          .from('shows')
          .select('seller_id')
          .eq('id', lot.show_id)
          .single();
        if (sErr) throw new Error(`Show fetch error: ${sErr.message}`);

        // Upsert payout row as pending (store dollars with 2 decimals)
        await supabase.from("payouts").upsert({
          order_id: orderId,
          seller_id: show.seller_id,
          amount: sellerCents / 100,
          status: 'pending',
          created_at: new Date().toISOString(),
        }, { onConflict: 'order_id' });
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as any;
      // Try to locate by payment_intent
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (pi) {
        await supabase.from('orders').update({ status: 'refunded' }).eq('stripe_payment_intent', pi);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
