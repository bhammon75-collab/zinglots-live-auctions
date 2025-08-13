import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || '*'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept-profile, content-profile',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function stripePost(path: string, body: Record<string, string>) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')

    // Auth-scoped client to identify the caller
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401, headers: cors })

    // Admin client for writing through RLS safely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false }, db: { schema: 'app' } }
    )

    // Look up or create seller row
    const { data: sellerRow } = await supabaseAdmin
      .from('sellers')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle()

    let acct = sellerRow?.stripe_account_id as string | null

    if (!acct) {
      const created: any = await stripePost('accounts', {
        type: 'express',
        'capabilities[transfers][requested]': 'true',
        'capabilities[card_payments][requested]': 'true',
        business_type: 'individual',
        email: user.email ?? '',
        'metadata[user_id]': user.id,
      })
      acct = created.id
      await supabaseAdmin
        .from('sellers')
        .upsert({ id: user.id, stripe_account_id: acct }, { onConflict: 'id' })
    }

    const link: any = await stripePost('account_links', {
      account: acct!,
      type: 'account_onboarding',
      return_url: `${SITE_URL}/dashboard/seller?connected=1`,
      refresh_url: `${SITE_URL}/dashboard/seller?reconnect=1`,
    })

    return new Response(JSON.stringify({ url: link.url, account: acct }), {
      headers: { ...cors, 'content-type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: cors })
  }
})
