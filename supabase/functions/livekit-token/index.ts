import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, prefer",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Temporary stub to unblock deployments; replace with real implementation when ready
  return new Response(
    JSON.stringify({ url: null, token: null, stub: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
