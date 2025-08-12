import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
    const { orderId } = await req.json();
    if (!orderId) throw new Error('orderId is required');

    const baseUrl = getEnv('PAYPAL_API_BASE', 'https://api-m.sandbox.paypal.com');
    const clientId = getEnv('PAYPAL_CLIENT_ID');
    const secret = getEnv('PAYPAL_CLIENT_SECRET');

    const accessToken = await getAccessToken(baseUrl, clientId, secret);

    const capResp = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!capResp.ok) {
      const t = await capResp.text();
      throw new Error(`PayPal capture error: ${capResp.status} ${t}`);
    }

    const data = await capResp.json();

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[paypal-capture-order] error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
