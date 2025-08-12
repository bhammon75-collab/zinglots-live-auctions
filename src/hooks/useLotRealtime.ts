import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

interface State {
  status?: 'queued'|'running'|'sold'|'unsold'|'void';
  endsAt?: string | null;
  topBid?: number;
  extendedPing?: boolean;
}

export function useLotRealtime(lotId: string) {
  const [state, setState] = useState<State>({});
  const lastEndsAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lotId) return;
    const sb = getSupabase();
    if (!sb) return;

    // Initial fetch
    (async () => {
      const { data: lot } = await sb.from('lots').select('status, ends_at').eq('id', lotId).maybeSingle();
      const { data: bid } = await sb.from('bids').select('amount').eq('lot_id', lotId).order('amount', { ascending: false }).limit(1).maybeSingle();
      setState((s) => ({ ...s, status: (lot as any)?.status, endsAt: (lot as any)?.ends_at, topBid: (bid as any)?.amount }));
      lastEndsAtRef.current = (lot as any)?.ends_at ?? null;
    })();

    const channel = sb.channel(`lot-${lotId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'lots', filter: `id=eq.${lotId}` }, (payload: any) => {
        const ends_at = payload.new.ends_at as string | null;
        const status = payload.new.status as State['status'];
        const extended = lastEndsAtRef.current && ends_at && new Date(ends_at).getTime() > new Date(lastEndsAtRef.current).getTime();
        lastEndsAtRef.current = ends_at ?? null;
        setState((s) => ({ ...s, endsAt: ends_at, status, extendedPing: extended || false }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'bids', filter: `lot_id=eq.${lotId}` }, (payload: any) => {
        const amount = Number(payload.new.amount);
        setState((s) => ({ ...s, topBid: Math.max(s.topBid ?? 0, amount) }));
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [lotId]);

  return state;
}

