import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept-profile",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error("orderId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false }, db: { schema: 'app' } }
    );

    // Create a tiny pseudo-PDF file in evidence bucket
    const content = new TextEncoder().encode(`ZingLots label for ${orderId}`);
    const path = `labels/${orderId}.pdf`;
    const { error: upErr } = await supabase.storage.from('evidence').upload(path, content, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (upErr) throw new Error(`Upload error: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage.from('evidence').createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr) throw new Error(`Signed URL error: ${signErr.message}`);

    const trackingSuffix = orderId.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase().padStart(6, '0');
    const resp = {
      labelUrl: signed.signedUrl,
      trackingNumber: `ZNG${trackingSuffix}`,
      carrier: 'USPS',
      costCents: 899,
      platformMarginCents: 100,
    };

    // Persist on order
    const { error: updErr } = await supabase
      .from('orders')
      .update({
        shipping_cents: resp.costCents,
        shipping_tracking: resp.trackingNumber,
        shipping_carrier: resp.carrier,
        label_url: resp.labelUrl,
      })
      .eq('id', orderId);
    if (updErr) throw new Error(`Order update error: ${updErr.message}`);

    return new Response(JSON.stringify(resp), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
