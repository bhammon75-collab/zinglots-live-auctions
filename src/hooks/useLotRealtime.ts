import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

// Extend status union to remain backward-compatible with existing consumers
export type LotStatus =
  | 'draft' | 'live' | 'ended' | 'settling' | 'settled'
  | 'queued' | 'running' | 'sold' | 'unsold' | 'void'

interface State {
  status?: LotStatus
  endsAt?: string | null
  topBid?: number | null
  reserveMet?: boolean
  highBidder?: string | null
  highBidderId?: string | null // backward compat
  extendedPing?: boolean // backward compat
}

export function useLotRealtime(lotId: string, auctionId?: string) {
  const [state, setState] = useState<State>({})
  const lastEndsAtRef = useRef<string | null>(null)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb || !lotId) return
    let mounted = true

    ;(async () => {
      const { data: lot } = await sb.schema('app')
        .from('lots')
        .select('status, ends_at, reserve_met, current_price, high_bidder, winner_id, auction_id')
        .eq('id', lotId).maybeSingle()
      if (!mounted) return
      const high = (lot as any)?.high_bidder ?? (lot as any)?.winner_id ?? null
      setState({
        status: (lot as any)?.status,
        endsAt: (lot as any)?.ends_at ?? null,
        reserveMet: !!(lot as any)?.reserve_met,
        topBid: (lot as any)?.current_price ?? null,
        highBidder: high,
        highBidderId: high,
        extendedPing: false,
      })
      lastEndsAtRef.current = (lot as any)?.ends_at ?? null
    })()

    const channel = sb.channel(`lot-${lotId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'app', table: 'lots', filter: `id=eq.${lotId}` },
        (payload: any) => {
          const ends = payload.new.ends_at as string | null
          const extended = lastEndsAtRef.current && ends &&
            new Date(ends).getTime() > new Date(lastEndsAtRef.current).getTime()
          lastEndsAtRef.current = ends ?? null
          const high = payload.new.high_bidder ?? payload.new.winner_id ?? null
          setState(s => ({
            ...s,
            status: payload.new.status as LotStatus,
            endsAt: ends,
            reserveMet: !!payload.new.reserve_met,
            topBid: typeof payload.new.current_price === 'number'
              ? Number(payload.new.current_price)
              : s.topBid,
            highBidder: high ?? s.highBidder,
            highBidderId: high ?? s.highBidderId,
            extendedPing: !!extended,
          }))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'bids', filter: `lot_id=eq.${lotId}` },
        (payload: any) => {
          const amount = Number(payload.new.amount)
          setState(s => ({ ...s, topBid: Math.max(s.topBid ?? 0, amount) }))
        })
      .subscribe()

    return () => { mounted = false; sb.removeChannel(channel) }
  }, [lotId, auctionId])

  return state
}
