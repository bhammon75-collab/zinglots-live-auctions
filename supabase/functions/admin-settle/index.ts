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
    const { orderId } = await req.json();
    if (!orderId) throw new Error("orderId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Auth: require admin using anon client with caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Validate token
    const { error: uErr } = await supabaseUser.auth.getUser();
    if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const { data: isAdmin } = await supabaseUser.rpc('app.is_admin');
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });

    // Get payout and seller (service role client for RLS-bypassed reads/writes)
    const { data: payout, error: pErr } = await supabaseAdmin
      .from('app.payouts')
      .select('order_id, amount, status, seller_id')
      .eq('order_id', orderId)
      .single();
    if (pErr) throw new Error(`Payout not found: ${pErr.message}`);
    if (payout.status !== 'pending') throw new Error('Payout not pending');

    const { data: seller, error: sErr } = await supabaseAdmin
      .from('app.sellers')
      .select('stripe_account_id')
      .eq('id', payout.seller_id)
      .single();
    if (sErr) throw new Error(`Seller fetch error: ${sErr.message}`);
    if (!seller.stripe_account_id) throw new Error('Seller not onboarded to Stripe');

    const amountCents = Math.round(Number(payout.amount) * 100);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: seller.stripe_account_id,
      description: `ZingLots order ${orderId}`,
    });

    await supabaseAdmin.from('app.payouts').update({ status: 'transferred', stripe_transfer_id: transfer.id }).eq('order_id', orderId);
    await supabaseAdmin.from('app.orders').update({ status: 'settled' }).eq('id', orderId);

    return new Response(JSON.stringify({ transferId: transfer.id, amount: amountCents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
