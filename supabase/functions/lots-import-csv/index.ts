// Deno Edge Function: lots-import-csv
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from "https://deno.land/std@0.224.0/csv/parse.ts"

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const show_id = url.searchParams.get("show_id")
    const seller_id = url.searchParams.get("seller_id")
    if (!show_id || !seller_id) return new Response(JSON.stringify({ error: "show_id and seller_id required" }), { status: 400, headers: cors })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
    })

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("text/csv") && !contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Send CSV file (text/csv)" }), { status: 400, headers: cors })
    }

    const csv = await req.text()
    const rows = await parse(csv, { skipFirstRow: false, columns: true }) as any[]

    const lots = rows.map(r => {
      const imgs = String(r.image_urls || "").split("|").filter(Boolean)
      return {
        show_id, seller_id,
        external_id: r.lot_external_id || null,
        title: r.title?.slice(0,120),
        description: r.description || "",
        starting_bid_cents: Number(r.starting_bid_cents || 0),
        reserve_cents: r.reserve_cents ? Number(r.reserve_cents) : null,
        buy_now_cents: r.buy_now_cents ? Number(r.buy_now_cents) : null,
        shipping_policy: r.shipping_policy || 'flat',
        shipping_flat_cents: Number(r.shipping_flat_cents || 0),
        handling_days: Number(r.handling_days || 2),
        category: r.category || null,
        tags: r.tags || null,
        condition: r.condition || null,
        weight_grams: r.weight_grams ? Number(r.weight_grams) : null,
        image_urls: imgs
      }
    })

    while (lots.length) {
      const batch = lots.splice(0, 200)
      const { error } = await supabase
        .from("app.lots")
        .insert(batch as any)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'content-type':'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: cors })
  }
})
