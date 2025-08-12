import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = new URL(req.url);
  const lotId = url.searchParams.get('lot_id') || '';
  if (!lotId) return new Response("lot_id is required", { status: 400, headers: corsHeaders });

  // Test injection hook
  const mocks = (globalThis as any).__BIDS_CSV_TEST_MOCKS__;
  const authHeader = req.headers.get("Authorization") || "";

  try {
    if (mocks) {
      const user = mocks.getUserByToken(authHeader);
      if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      const lot = await mocks.getLotById(lotId);
      const show = await mocks.getShowById(lot.show_id);
      const role = await mocks.getProfileRole(user.id);
      const isSeller = show.seller_id === user.id;
      const isAdmin = role === 'admin';
      if (!isSeller && !isAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });
      const rows = await mocks.getCsvRows();
      const header = 'timestamp,alias,amount,is_proxy\n';
      const body = rows.map((r: any) => `${new Date(r.created_at).toISOString()},${r.alias},${r.amount},${r.is_proxy ? 'true' : 'false'}`).join('\n');
      return new Response(header + body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bids_${lotId}_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
      db: { schema: 'app' },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: 'app' } });

    // Verify user
    const { data: userRes, error: uErr } = await supabaseAuth.auth.getUser();
    if (uErr || !userRes?.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const uid = userRes.user.id;

    // Load lot -> show -> seller
    const { data: lot, error: lErr } = await supabaseAdmin
      .from('lots').select('id, show_id').eq('id', lotId).single();
    if (lErr || !lot) return new Response("Lot not found", { status: 404, headers: corsHeaders });

    const { data: show, error: sErr } = await supabaseAdmin
      .from('shows').select('seller_id').eq('id', lot.show_id).single();
    if (sErr || !show) return new Response("Show not found", { status: 404, headers: corsHeaders });

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles').select('role').eq('id', uid).single();
    if (pErr) return new Response(pErr.message, { status: 400, headers: corsHeaders });

    const isSeller = show.seller_id === uid;
    const isAdmin = profile?.role === 'admin';
    if (!isSeller && !isAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const { data: rows, error: rErr } = await supabaseAdmin.rpc('public_bids_for_csv', { p_lot_id: lotId });
    if (rErr) return new Response(rErr.message, { status: 400, headers: corsHeaders });

    const header = 'timestamp,alias,amount,is_proxy\n';
    const body = (rows as any[]).map((r) => `${new Date(r.created_at).toISOString()},${r.alias},${r.amount},${r.is_proxy ? 'true' : 'false'}`).join('\n');

    return new Response(header + body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bids_${lotId}_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (err: any) {
    return new Response(err?.message || "Unexpected error", { status: 500, headers: corsHeaders });
  }
};

serve(handler);
