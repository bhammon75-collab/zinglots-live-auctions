import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { nextMinimum } from "@/lib/bidding";
import { VerifyModal } from "./VerifyModal";
import { useLotRealtime } from "@/hooks/useLotRealtime";

export type BidPanelProps = {
  lot: {
    id: string;
    auction_id: string;
    title: string;
    starting_bid: number;
    current_price: number | null;
    reserve_met: boolean;
    high_bidder?: string | null;
  };
  auction: {
    id: string;
    ends_at: string; // ISO
    soft_close_secs: number;
  };
  userTier: { tier: 0 | 1 | 2; cap?: number | null };
  isSeller: boolean;
};

function formatUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function BidPanel({ lot, auction, userTier, isSeller }: BidPanelProps) {
  const sb = getSupabase();
  const { toast } = useToast();
  const [offered, setOffered] = useState<string>("");
  const [max, setMax] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const realtime = useLotRealtime(lot.id);

  const currentPrice = useMemo(() => {
    return (realtime.topBid ?? lot.current_price ?? null) ?? null;
  }, [realtime.topBid, lot.current_price]);

  const minNext = useMemo(() => nextMinimum(currentPrice, lot.starting_bid), [currentPrice, lot.starting_bid]);

  // Countdown
  const [remaining, setRemaining] = useState<string>("");
  const lastEndsRef = useRef<string>(auction.ends_at);
  useEffect(() => {
    const id = setInterval(() => {
      const endsAt = realtime.endsAt ?? auction.ends_at;
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Ended");
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setRemaining(`${m}:${String(s).padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [auction.ends_at, realtime.endsAt]);

  // Soft-close toast
  useEffect(() => {
    const prev = lastEndsRef.current;
    const nowEnds = realtime.endsAt ?? auction.ends_at;
    if (prev && nowEnds && nowEnds !== prev) {
      const prevMs = new Date(prev).getTime();
      const nowMs = new Date(nowEnds).getTime();
      if (nowMs - prevMs >= auction.soft_close_secs * 1000) {
        toast({ description: `Extended +${Math.floor(auction.soft_close_secs / 60)}:00` });
      }
    }
    lastEndsRef.current = nowEnds;
  }, [realtime.endsAt, auction.soft_close_secs, auction.ends_at, toast]);

  const isEnded = useMemo(() => new Date(realtime.endsAt ?? auction.ends_at).getTime() <= Date.now(), [realtime.endsAt, auction.ends_at]);

  const onSubmit = async () => {
    if (!sb) return toast({ description: "Supabase not configured" });
    if (isSeller) return;
    const offerNum = Number(offered);
    const maxNum = max ? Number(max) : null;
    if (!Number.isFinite(offerNum) || offerNum <= 0) {
      return toast({ description: "Enter a valid offer" });
    }

    const cap = userTier.cap ?? (userTier.tier === 0 ? 200 : userTier.tier === 1 ? 1000 : Infinity);
    const consider = Math.max(offerNum, maxNum ?? offerNum);
    if (consider > cap) {
      setVerifyOpen(true);
      return;
    }

    try {
      setSubmitting(true);
      const { data: userRes } = await sb.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error("Please sign in to bid");

      // Our RPC expects p_lot, p_bidder, p_amount (proxy max)
      const { error } = await sb.rpc("app.place_bid", {
        p_lot: lot.id,
        p_bidder: uid,
        p_amount: consider,
      });
      if (error) {
        const msg = error.message || "Bid failed";
        // Parse minimum requirement pattern if present
        const m = msg.match(/Minimum acceptable is\s*\$?(\d+(?:\.\d+)?)/i);
        if (m) {
          toast({ description: `Minimum acceptable is ${formatUSD(Number(m[1]))}` });
        } else if (/tier|cap|verify/i.test(msg)) {
          setVerifyOpen(true);
        } else {
          toast({ description: msg });
        }
        return;
      }
      setOffered("");
      setMax("");
      toast({ description: `Bid placed: up to ${formatUSD(consider)}` });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCsv = async () => {
    if (!sb) return;
    // Seller-only; fetch anonymized history from view
    const { data, error } = await sb
      .schema('app')
      .from('bid_history')
      .select('created_at, amount, is_proxy, lot_id, bidder_alias')
      .eq('lot_id', lot.id)
      .order('created_at', { ascending: true });
    if (error) return toast({ description: error.message });
    const rows = data as any[];
    const header = ['created_at','alias','amount','is_proxy'];
    const csv = [header.join(',')]
      .concat(rows.map(r => `${new Date(r.created_at).toISOString()},${r.bidder_alias},${r.amount},${r.is_proxy ? 'yes':'no'}`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date().toISOString().slice(0,10);
    a.download = `bids_${lot.id}_${d}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="bid-panel" className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="bid-panel" className="text-sm font-medium">Place a bid</h2>
        <Badge variant={realtime.reserveMet || lot.reserve_met ? "default" : "secondary"}>
          {realtime.reserveMet || lot.reserve_met ? 'RESERVE MET ✅' : 'RESERVE NOT MET'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Current</div>
          <div className="text-2xl font-semibold">{formatUSD(currentPrice ?? lot.starting_bid)}</div>
          <div className="text-xs text-muted-foreground">Next minimum: {formatUSD(minNext)}</div>
        </div>
        <div className="justify-self-end text-right">
          <div className="text-xs text-muted-foreground">Ends in</div>
          <div className="text-2xl font-semibold">{remaining}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="offered" className="text-xs text-muted-foreground">Offered</label>
          <Input id="offered" inputMode="decimal" placeholder={`Enter ≥ ${formatUSD(minNext)}`} value={offered}
            onChange={(e) => setOffered(e.target.value)} aria-label="Offered amount" />
        </div>
        <div className="space-y-1">
          <label htmlFor="max" className="text-xs text-muted-foreground">Max bid (optional)</label>
          <Input id="max" inputMode="decimal" placeholder="Proxy cap" value={max}
            onChange={(e) => setMax(e.target.value)} aria-label="Maximum bid cap" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSubmit} disabled={isSeller || isEnded || submitting} aria-busy={submitting}>
          {isEnded ? 'Auction ended' : isSeller ? 'Sellers cannot bid' : submitting ? 'Submitting…' : 'Place bid'}
        </Button>
        {isSeller && (
          <Button variant="outline" onClick={downloadCsv}>Download bid history (CSV)</Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">Earlier max wins. Auto-bids in minimum increments.</div>
      </div>

      <VerifyModal open={verifyOpen} onOpenChange={setVerifyOpen} onStripeIdentity={() => {
        setVerifyOpen(false);
        toast({ description: 'Stripe Identity flow coming soon.' });
      }} onManualUpload={() => {
        setVerifyOpen(false);
        toast({ description: 'Manual review upload coming soon.' });
      }} />
    </section>
  );
}
