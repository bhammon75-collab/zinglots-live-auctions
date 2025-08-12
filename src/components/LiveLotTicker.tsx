import { useEffect } from 'react';
import { useLotRealtime } from '@/hooks/useLotRealtime';

export default function LiveLotTicker({ lotId }: { lotId: string }) {
  const { topBid, endsAt, status, extendedPing } = useLotRealtime(lotId);

  // subtle ping using Web Audio API
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

  const timeLeft = (() => {
    if (!endsAt) return ''; 
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
  })();

  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
      <div>
        <div className="text-muted-foreground">Current bid</div>
        <div className="font-semibold">{topBid ? `$${Number(topBid).toFixed(2)}` : '--'}</div>
      </div>
      <div className={`rounded px-2 py-1 font-mono ${extendedPing ? 'animate-pulse bg-secondary text-secondary-foreground' : 'bg-muted text-foreground'}`}>
        {status === 'running' ? timeLeft : status}
      </div>
    </div>
  );
}
