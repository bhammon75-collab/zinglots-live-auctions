import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

export type LotStatus = 'queued' | 'running' | 'sold' | 'unsold' | 'void' | 'draft' | 'live' | 'ended' | 'settling' | 'settled'

interface State {
  status?: LotStatus
  endsAt?: string | null
  topBid?: number | null
  reserveMet?: boolean
  highBidder?: string | null
  highBidderId?: string | null
  extendedPing?: boolean
}

export function useLotRealtime(lotId: string, _auctionId?: string) {
  const [state, setState] = useState<State>({})
  const lastEndsAtRef = useRef<string | null>(null)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb || !lotId) return
    let mounted = true

    ;(async () => {
      const { data: lot } = await sb.schema('app')
        .from('lots')
        .select('status, ends_at, reserve_met, winner_id')
        .eq('id', lotId)
        .maybeSingle()

      if (!mounted) return

      setState({
        status: (lot as any)?.status,
        endsAt: (lot as any)?.ends_at ?? null,
        reserveMet: !!(lot as any)?.reserve_met,
        topBid: null,
        highBidder: (lot as any)?.winner_id ?? null,
        highBidderId: (lot as any)?.winner_id ?? null,
        extendedPing: false,
      })
      lastEndsAtRef.current = (lot as any)?.ends_at ?? null

      const { data: top } = await sb.schema('app')
        .from('bids')
        .select('amount')
        .eq('lot_id', lotId)
        .order('amount', { ascending: false })
        .limit(1)
      if (!mounted) return
      const topBid = top && top.length > 0 ? Number(top[0].amount) : null
      setState((s) => ({ ...s, topBid }))
    })()

    const channel = sb.channel(`lot-${lotId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'app', table: 'lots', filter: `id=eq.${lotId}` },
        (payload: any) => {
          const ends = payload.new.ends_at as string | null
          const extended = !!(lastEndsAtRef.current && ends && new Date(ends).getTime() > new Date(lastEndsAtRef.current).getTime())
          lastEndsAtRef.current = ends ?? null
          setState((s) => ({
            ...s,
            status: payload.new.status as LotStatus,
            endsAt: ends,
            reserveMet: !!payload.new.reserve_met,
            highBidder: payload.new.winner_id ?? s.highBidder,
            highBidderId: payload.new.winner_id ?? s.highBidderId,
            extendedPing: extended,
          }))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'bids', filter: `lot_id=eq.${lotId}` },
        (payload: any) => {
          const amount = Number(payload.new.amount)
          setState((s) => ({ ...s, topBid: Math.max(s.topBid ?? 0, amount) }))
        })
      .subscribe()

    return () => { mounted = false; sb.removeChannel(channel) }
  }, [lotId])

  useMemo(() => state.endsAt, [state.endsAt])

  return state
}
