import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Row = { created_at: string; alias: string; amount: number; is_proxy: boolean };
type Deps = {
  getUser(req: Request): Promise<{ id: string } | null>;
  getLot(id: string): Promise<{ seller_id: string; auction_id: string } | null>;
  getProfile(uid: string): Promise<{ role: string } | null>;
  getRows(id: string): Promise<Row[]>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

    const url = new URL(req.url);
    const lotId = url.searchParams.get("lot_id") ?? "";
    if (!lotId) return new Response("lot_id is required", { status: 400, headers: corsHeaders });

    const user = await deps.getUser(req);
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const lot = await deps.getLot(lotId);
    if (!lot) return new Response("Not Found", { status: 404, headers: corsHeaders });

    const prof = await deps.getProfile(user.id);
    const ok = prof?.role === "admin" || lot.seller_id === user.id;
    if (!ok) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const rows = await deps.getRows(lotId);
    const header = "timestamp,alias,amount,is_proxy\n";
    const body = rows
      .map((r) => [new Date(r.created_at).toISOString(), r.alias, r.amount, r.is_proxy ? "true" : "false"].join(","))
      .join("\n");
    const fn = `bids_${lotId}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(header + body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fn}"`,
      },
    });
  };
}

async function getRealDeps() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  return {
    async getUser(req: Request) {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (!token) return null;
      const sb = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
        db: { schema: "app" },
      });
      const { data, error } = await sb.auth.getUser();
      if (error || !data?.user) return null;
      return { id: data.user.id };
    },
    async getLot(id: string) {
      // lots may not have seller directly; join via shows to find seller
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: "app" } });
      const { data: lot, error: lErr } = await admin.from("lots").select("id, show_id").eq("id", id).maybeSingle();
      if (lErr || !lot) return null;
      const { data: show } = await admin.from("shows").select("seller_id").eq("id", (lot as any).show_id).maybeSingle();
      if (!show) return null;
      return { seller_id: (show as any).seller_id, auction_id: (lot as any).show_id };
    },
    async getProfile(uid: string) {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: "app" } });
      const { data } = await admin.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (!data) return null;
      return { role: (data as any).role } as any;
    },
    async getRows(id: string) {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }, db: { schema: "app" } });
      const { data, error } = await admin.rpc("public_bids_for_csv", { p_lot_id: id });
      if (error || !data) return [] as Row[];
      return data as Row[];
    },
  } satisfies Deps;
}

if (import.meta.main) {
  const realDepsPromise = getRealDeps();
  serve(async (req) => {
    const handler = createHandler(await realDepsPromise);
    return handler(req);
  });
}
