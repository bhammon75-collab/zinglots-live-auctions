import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/index.ts'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function restJwt() {
  const now = Math.floor(Date.now() / 1000);
  const apiKey = Deno.env.get('LIVEKIT_API_KEY')!;
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!;
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', kid: apiKey })
    .setIssuer(apiKey)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(apiSecret));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { roomName, destinations = [], layout = 'grid' } = await req.json();
    if (!roomName) throw new Error('roomName is required');
    const restUrl = Deno.env.get('LIVEKIT_REST_URL');
    if (!restUrl) throw new Error('LIVEKIT_REST_URL not configured');

    const outputs = destinations.map((d: any) => `${d.url.replace(/\/$/, '')}/${d.key}`);
    const token = await restJwt();

    const r = await fetch(restUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        room_name: roomName,
        layout,
        stream_outputs: outputs.map((u: string) => ({ protocol: 'rtmp', urls: [u] })),
      }),
    });

    const txt = await r.text();
    if (!r.ok) return new Response(JSON.stringify({ error: txt }), { status: 400, headers: cors });

    return new Response(txt, { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 400, headers: cors });
  }
});
