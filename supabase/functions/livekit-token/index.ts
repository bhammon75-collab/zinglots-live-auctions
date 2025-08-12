import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, identity, isHost } = await req.json();
    if (!roomId || !identity) throw new Error("roomId and identity are required");

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) throw new Error("LiveKit secrets not set");

    const at = new AccessToken(apiKey, apiSecret, { identity, ttl: 60 * 60 });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      roomCreate: isHost === true,
      canPublish: isHost === true,
      canSubscribe: true,
    } as any);

    const token = await at.toJwt();

    return new Response(JSON.stringify({ url, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message } satisfies { error: string }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
