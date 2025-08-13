import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function enc(s: string) { return new TextEncoder().encode(s); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { roomName, identity, ttlSeconds = 3600, isPublisher = false } = await req.json();
    if (!roomName) throw new Error("roomName is required");
    const kid = Deno.env.get('LIVEKIT_API_KEY');
    const secret = Deno.env.get('LIVEKIT_API_SECRET');
    const lkUrl = Deno.env.get('LIVEKIT_URL');
    if (!kid || !secret || !lkUrl) throw new Error('LiveKit env not configured');

    const grant: Record<string, unknown> = {
      video: {
        roomJoin: true,
        room: roomName,
        canPublish: !!isPublisher,
        canSubscribe: true,
        canPublishData: true,
      }
    };
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT(grant)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid })
      .setIssuer(kid)
      .setSubject(identity || 'anon')
      .setAudience(lkUrl)
      .setIssuedAt(now)
      .setExpirationTime(now + Number(ttlSeconds))
      .sign(enc(secret));

    return new Response(JSON.stringify({ url: lkUrl, token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
