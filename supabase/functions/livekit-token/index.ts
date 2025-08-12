import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { AccessToken } from "https://esm.sh/@livekit/server-sdk@2.5.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept-profile",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false }, db: { schema: 'app' } }
    );
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { db: { schema: 'app' } }
    );

    // Require signed in user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await anon.auth.getUser(token);
    if (authErr) return new Response(JSON.stringify({ error: authErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    const user = userData.user!;

    // roomId = show_<uuid>; fetch show
    const showId = roomId.replace(/^show_/, "");
    const { data: show, error: sErr } = await supabase
      .from('shows')
      .select('id, seller_id')
      .eq('id', showId)
      .single();
    if (sErr) return new Response(JSON.stringify({ error: `Show not found: ${sErr.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });

    if (isHost) {
      // Host must be the seller of the show and verified + onboarded
      const { data: seller, error: selErr } = await supabase
        .from('sellers')
        .select('id, kyc_status, stripe_account_id')
        .eq('id', show.seller_id)
        .single();
      if (selErr) return new Response(JSON.stringify({ error: `Seller not found: ${selErr.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
      if (seller.id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
      if (seller.kyc_status !== 'verified' || !seller.stripe_account_id) return new Response(JSON.stringify({ error: 'Seller not verified/onboarded' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity, ttl: 60 * 10 });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      roomCreate: isHost === true,
      canPublish: isHost === true,
      canSubscribe: true,
    } as any);

    const tokenJwt = await at.toJwt();

    return new Response(JSON.stringify({ url, token: tokenJwt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
