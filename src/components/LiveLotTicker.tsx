import { useEffect, useRef, useState } from 'react';
import { useLotRealtime } from '@/hooks/useLotRealtime';

export default function LiveLotTicker({ lotId }: { lotId: string }) {
  const { topBid, endsAt, status, extendedPing } = useLotRealtime(lotId);

  const [now, setNow] = useState<number>(Date.now());
  const lastSecondRef = useRef<number | null>(null);
  const baselineMsRef = useRef<number>(0);

  // Tick timer to update countdown smoothly
  useEffect(() => {
    if (!endsAt || status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt, status]);

  // Set/reset baseline when first seen or when soft-close extends
  useEffect(() => {
    if (!endsAt) return;
    if (baselineMsRef.current <= 0 || extendedPing) {
      const msLeft = new Date(endsAt).getTime() - Date.now();
      baselineMsRef.current = Math.max(msLeft, 0);
    }
  }, [endsAt, extendedPing]);

  // subtle ping using Web Audio API on soft-close extension
  useEffect(() => {
    if (!extendedPing) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.02;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 120);
    } catch {}
  }, [extendedPing]);

  // Final 10-second beeps
  useEffect(() => {
    if (!endsAt || status !== 'running') return;
    const msLeft = new Date(endsAt).getTime() - now;
    const sLeft = Math.max(0, Math.ceil(msLeft / 1000));
    if (sLeft <= 10 && sLeft >= 1 && lastSecondRef.current !== sLeft) {
      lastSecondRef.current = sLeft;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = sLeft === 1 ? 1200 : 1000;
        g.gain.value = 0.04;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        setTimeout(() => { o.stop(); ctx.close(); }, 100);
      } catch {}
    }
    if (sLeft === 0) {
      lastSecondRef.current = 0;
    }
  }, [endsAt, now, status]);

  const msLeft = endsAt ? new Date(endsAt).getTime() - now : 0;
  const sLeft = Math.max(0, Math.floor(msLeft / 1000));

  const timeLeft = (() => {
    if (!endsAt) return '';
    if (msLeft <= 0) return '0s';
    const s = Math.floor(msLeft / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
  })();

  const percent = (() => {
    const total = baselineMsRef.current;
    if (!endsAt || total <= 0) return 0;
    return Math.max(0, Math.min(100, (msLeft / total) * 100));
  })();

  const barColorCls =
    sLeft <= 10 ? 'bg-destructive'
    : sLeft <= 30 ? 'bg-accent'
    : 'bg-primary';

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-muted-foreground">Current bid</div>
          <div className="font-semibold">{topBid ? `$${Number(topBid).toFixed(2)}` : '--'}</div>
        </div>
        <div className={`rounded px-2 py-1 font-mono ${extendedPing ? 'animate-pulse bg-secondary text-secondary-foreground' : 'bg-muted text-foreground'}`} aria-live="polite">
          {status === 'running' ? timeLeft : status}
        </div>
      </div>
      {status === 'running' && endsAt ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
          <div className={`h-full transition-all ${barColorCls}`} style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
