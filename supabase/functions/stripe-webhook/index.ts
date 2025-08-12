import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", 
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
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
          .from("app.orders")
          .select("id, subtotal, fees_bps, lot_id")
          .eq("id", orderId)
          .single();
        if (oErr) throw new Error(`Order fetch error: ${oErr.message}`);

        const amountDollars = Number(order.subtotal ?? 0);
        const feeBps = Number(order.fees_bps ?? 1200);
        const platformFee = Math.round((amountDollars * feeBps) / 10000 * 100) / 100; // 2 decimals
        const sellerAmount = Math.max(0, Math.round((amountDollars - platformFee) * 100) / 100);

        await supabase.from("app.orders").update({
          status: 'paid',
          stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
        }).eq("id", orderId);

        // Find seller for this lot
        const { data: sellerRow, error: sErr } = await supabase
          .from("app.lots")
          .select("show_id, app.shows!inner(seller_id)")
          .eq("id", order.lot_id)
          .single();
        if (sErr) throw new Error(`Seller lookup error: ${sErr.message}`);
        const sellerId = (sellerRow as any).shows.seller_id as string;

        // Upsert payout row as pending
        await supabase.from("app.payouts").upsert({
          order_id: orderId,
          seller_id: sellerId,
          amount: sellerAmount,
          status: 'pending',
          created_at: new Date().toISOString(),
        }, { onConflict: 'order_id' });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
