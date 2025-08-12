import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept-profile",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Provider = 'easypost' | 'shippo';

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId, provider = 'easypost' } = await req.json();
    if (!orderId) throw new Error("orderId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false }, db: { schema: 'app' } }
    );

    // Minimal addresses: in real app fetch from DB; here use test defaults
    const shipFrom = {
      name: "ZingLots Seller",
      street1: "417 MONTGOMERY ST",
      street2: "FLOOR 5",
      city: "SAN FRANCISCO",
      state: "CA",
      zip: "94104",
      country: "US",
      phone: "999-999-9999",
      email: "seller@example.com"
    };
    const shipTo = {
      name: "ZingLots Buyer",
      street1: "388 Townsend St",
      city: "San Francisco",
      state: "CA",
      zip: "94107",
      country: "US",
      phone: "999-999-9999",
      email: "buyer@example.com"
    };

    // One-pound package as default
    const parcel = { length: 8, width: 6, height: 2, weight: 16 };

    let labelUrl = "";
    let trackingNumber = "";
    let carrier = "USPS";
    let costCents = 0;

    if ((provider as Provider) === 'easypost') {
      const apiKey = Deno.env.get('EASYPOST_API_KEY');
      if (!apiKey) throw new Error('EASYPOST_API_KEY not set');
      // Create shipment and buy lowest rate
      const createResp = await fetch('https://api.easypost.com/v2/shipments', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(apiKey + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipment: {
            to_address: shipTo,
            from_address: shipFrom,
            parcel,
            options: { label_format: 'PDF' }
          }
        })
      });
      if (!createResp.ok) throw new Error(`EasyPost create error: ${await createResp.text()}`);
      const shipment = await createResp.json();
      const lowest = shipment?.rates?.[0];
      if (!lowest) throw new Error('No rates available');
      const buyResp = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(apiKey + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rate: { id: lowest.id } })
      });
      if (!buyResp.ok) throw new Error(`EasyPost buy error: ${await buyResp.text()}`);
      const bought = await buyResp.json();
      labelUrl = bought?.postage_label?.label_url;
      trackingNumber = bought?.tracker?.tracking_code || bought?.tracking_code;
      carrier = lowest?.carrier || carrier;
      costCents = Math.round(Number(lowest?.rate || 0) * 100);
    } else if ((provider as Provider) === 'shippo') {
      const token = Deno.env.get('SHIPPO_API_TOKEN');
      if (!token) throw new Error('SHIPPO_API_TOKEN not set');
      const rateResp = await fetch('https://api.goshippo.com/shipments/', {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address_from: shipFrom,
          address_to: shipTo,
          parcels: [{ ...parcel, distance_unit: 'in', mass_unit: 'oz' }],
          async: false
        })
      });
      if (!rateResp.ok) throw new Error(`Shippo create error: ${await rateResp.text()}`);
      const shipment = await rateResp.json();
      const lowest = shipment?.rates?.[0];
      if (!lowest) throw new Error('No rates available');
      const transResp = await fetch('https://api.goshippo.com/transactions/', {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate: lowest.object_id,
          label_file_type: 'PDF'
        })
      });
      if (!transResp.ok) throw new Error(`Shippo buy error: ${await transResp.text()}`);
      const trans = await transResp.json();
      labelUrl = trans?.label_url;
      trackingNumber = trans?.tracking_number;
      carrier = lowest?.provider || carrier;
      costCents = Math.round(Number(lowest?.amount || 0) * 100);
    } else {
      throw new Error('Unsupported provider');
    }

    const margin = Number(Deno.env.get('SHIPPING_PLATFORM_MARGIN_CENTS') || 0);

    const { error: updErr } = await supabase
      .from('orders')
      .update({
        shipping_cents: costCents + margin,
        shipping_tracking: trackingNumber,
        shipping_carrier: carrier,
        label_url: labelUrl,
      })
      .eq('id', orderId);
    if (updErr) throw new Error(`Order update error: ${updErr.message}`);

    return new Response(JSON.stringify({ labelUrl, trackingNumber, carrier, costCents, platformMarginCents: margin }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
