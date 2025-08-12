import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { lotId } = await req.json();
    if (!lotId || typeof lotId !== 'string') return json({ error: 'lotId is required' }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
      db: { schema: 'app' },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: 'app' } });

    // Verify user
    const { data: userRes, error: uErr } = await supabaseAuth.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const uid = userRes.user.id;

    // Fetch seller for lot via shows
    const { data: lot, error: lErr } = await supabaseAdmin
      .from('lots').select('id, show_id').eq('id', lotId).single();
    if (lErr || !lot) return json({ error: 'Lot not found' }, 404);

    const { data: show, error: sErr } = await supabaseAdmin
      .from('shows').select('seller_id').eq('id', lot.show_id).single();
    if (sErr || !show) return json({ error: 'Show not found' }, 404);

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles').select('role').eq('id', uid).single();
    if (pErr) return json({ error: pErr.message }, 400);

    const isSeller = show.seller_id === uid;
    const isAdmin = profile?.role === 'admin';
    if (!isSeller && !isAdmin) return json({ error: 'Forbidden' }, 403);

    // Get anonymized bids via RPC
    const { data: rows, error: rErr } = await supabaseAdmin.rpc('public_bids_for_csv', { p_lot_id: lotId });
    if (rErr) return json({ error: rErr.message }, 400);

    const header = 'timestamp,alias,amount,is_proxy\n';
    const body = (rows as any[]).map((r) => {
      const ts = new Date(r.created_at).toISOString();
      const alias = String(r.alias ?? 'Bidder???').replaceAll('"', '""');
      const amount = r.amount;
      const proxy = r.is_proxy ? 'true' : 'false';
      return `${ts},${alias},${amount},${proxy}`;
    }).join('\n');

    return json({ csv: header + body }, 200);
  } catch (err: any) {
    return json({ error: err?.message || 'Unexpected error' }, 500);
  }
});
