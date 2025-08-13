import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getEnv = (name: string, fallback?: string) => {
  const v = Deno.env.get(name);
  if (!v && !fallback) throw new Error(`${name} is not set`);
  return v ?? fallback!;
};

async function getAccessToken(baseUrl: string, clientId: string, secret: string) {
  const creds = btoa(`${clientId}:${secret}`);
  const resp = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`PayPal token error: ${resp.status} ${t}`);
  }
  const json = await resp.json();
  return json.access_token as string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, currency = 'USD', description = 'ZingLots Order', orderId } = body;

    const baseUrl = getEnv('PAYPAL_API_BASE', 'https://api-m.sandbox.paypal.com');
    const clientId = getEnv('PAYPAL_CLIENT_ID');
    const secret = getEnv('PAYPAL_CLIENT_SECRET');

    let totalValue: string;
    let customId: string | undefined;

    if (orderId) {
      // Compute total from DB snapshot
      const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false }, db: { schema: 'app' } });
      const { data: o, error: oe } = await supabase
        .from('orders')
        .select('id, subtotal, shipping_cents, shipping_flat_cents')
        .eq('id', orderId)
        .single();
      if (oe) throw new Error(`Order not found: ${oe.message}`);
      const subtotalCents = Math.round(Number(o.subtotal) * 100);
      const shippingCents = Number(o.shipping_flat_cents || o.shipping_cents || 0);
      totalValue = ((subtotalCents + shippingCents) / 100).toFixed(2);
      customId = orderId;
    } else {
      if (!amount || isNaN(Number(amount))) throw new Error('Amount is required');
      totalValue = Number(amount).toFixed(2);
    }

    const accessToken = await getAccessToken(baseUrl, clientId, secret);

    const bodyOut = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: currency, value: totalValue },
          description,
          custom_id: customId,
        },
      ],
      application_context: {
        brand_name: 'ZingLots',
        user_action: 'PAY_NOW',
      },
    };

    const createResp = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyOut),
    });

    if (!createResp.ok) {
      const t = await createResp.text();
      throw new Error(`PayPal create order error: ${createResp.status} ${t}`);
    }

    const order = await createResp.json();
    const approveUrl: string | undefined = order.links?.find((l: any) => l.rel === 'approve')?.href;

    return new Response(
      JSON.stringify({ id: order.id, status: order.status, approveUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[paypal-create-order] error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
