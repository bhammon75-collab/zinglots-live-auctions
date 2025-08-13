import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { order_id, carrier, tracking_number, tracking_url, shipped_at } = await req.json();
    if (!order_id) throw new Error('order_id is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        db: { schema: 'app' },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      }
    );

    // Upsert shipment by order_id (table doesn't have a unique constraint on order_id, so emulate)
    const { data: existing } = await supabase.from('shipments').select('id').eq('order_id', order_id).maybeSingle();
    if (existing?.id) {
      const { error: upErr } = await supabase
        .from('shipments')
        .update({
          status: 'shipped',
          carrier,
          tracking_number,
          tracking_url,
          shipped_at: shipped_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await supabase.from('shipments').insert({
        order_id,
        status: 'shipped',
        carrier,
        tracking_number,
        tracking_url,
        shipped_at: shipped_at ?? new Date().toISOString(),
      });
      if (insErr) throw new Error(insErr.message);
    }

    // Update legacy columns + shipped_at on orders for backward compatibility
    const { error: ordErr } = await supabase
      .from('orders')
      .update({
        shipping_tracking: tracking_number,
        shipping_carrier: carrier,
        shipped_at: shipped_at ?? new Date().toISOString(),
      })
      .eq('id', order_id);
    if (ordErr) throw new Error(ordErr.message);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 400, headers: cors });
  }
});
