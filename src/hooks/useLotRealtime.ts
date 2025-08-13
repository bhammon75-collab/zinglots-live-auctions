import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

type LotStatus = 'draft'|'running'|'live'|'ended'|'settling'|'settled'
interface State {
  status?: LotStatus
  endsAt?: string | null
  topBid?: number | null
  reserveMet?: boolean
  highBidder?: string | null
  highBidderId?: string | null
  extendedPing?: number
}

export function useLotRealtime(lotId: string) {
  const [state, setState] = useState<State>({})
  const lastEndsAtRef = useRef<string | null>(null)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb || !lotId) return
    let mounted = true

    ;(async () => {
      const { data: lot } = await sb.schema('app')
        .from('lots')
        .select('status, ends_at, reserve_met, current_price, high_bidder, high_bidder_id')
        .eq('id', lotId).maybeSingle()
      const { data: top } = await sb.schema('app')
        .from('bids').select('amount').eq('lot_id', lotId)
        .order('amount', { ascending: false }).limit(1).maybeSingle()

      if (!mounted) return
      setState({
        status: (lot as any)?.status,
        endsAt: (lot as any)?.ends_at ?? null,
        reserveMet: !!(lot as any)?.reserve_met,
        topBid: (top as any)?.amount ?? (lot as any)?.current_price ?? null,
        highBidder: (lot as any)?.high_bidder ?? null,
        highBidderId: (lot as any)?.high_bidder_id ?? null,
      })
      lastEndsAtRef.current = (lot as any)?.ends_at ?? null
    })()

    const ch = sb.channel(`lot-${lotId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'app', table: 'lots', filter: `id=eq.${lotId}` },
        (payload: any) => {
          const ends = payload.new.ends_at as string | null
          const prev = lastEndsAtRef.current
          lastEndsAtRef.current = ends ?? null
          setState(s => ({
            ...s,
            status: payload.new.status as LotStatus,
            endsAt: ends,
            reserveMet: !!payload.new.reserve_met,
            topBid: typeof payload.new.current_price === 'number' ? Number(payload.new.current_price) : s.topBid,
            highBidder: payload.new.high_bidder ?? s.highBidder,
            highBidderId: payload.new.high_bidder_id ?? s.highBidderId,
            extendedPing: (prev && ends && new Date(ends).getTime() > new Date(prev).getTime()) ? Date.now() : s.extendedPing
          }))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'bids', filter: `lot_id=eq.${lotId}` },
        (payload: any) => {
          const amount = Number(payload.new.amount)
          setState(s => ({ ...s, topBid: Math.max(s.topBid ?? 0, amount) }))
        })
      .subscribe()

    return () => { mounted = false; sb.removeChannel(ch) }
  }, [lotId])

  return state
}
