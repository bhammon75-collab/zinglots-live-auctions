import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import LiveLotTicker from "@/components/LiveLotTicker";
import BidTicker, { type TickerBid } from "@/components/BidTicker";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { useParams } from "react-router-dom";
import { useLotRealtime } from "@/hooks/useLotRealtime";
import { usePresence } from "@/hooks/usePresence";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export default function AuctionRoom() {
  const { lotId = "" } = useParams();
  const { topBid } = useLotRealtime(lotId);
  const { participants, count } = usePresence(`auction:${lotId}`);

  const [desired, setDesired] = useState<number | null>(null);
  const sb = getSupabase();

  useEffect(() => {
    if (topBid != null && desired == null) {
      setDesired(Number(topBid) + 1);
    }
  }, [topBid, desired]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDesired((d) => (d == null ? (Number(topBid ?? 0) + 1) : d + 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        placeBid();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [topBid]);

  const placeBid = async () => {
    if (!sb) return toast({ description: "Supabase not configured" });
    if (!lotId) return toast({ description: "No lot specified" });
    const amt = desired ?? (Number(topBid ?? 0) + 1);
    const { data: user } = await sb.auth.getUser();
    if (!user?.user) return toast({ description: "Please sign in to bid" });
    const { error } = await sb.rpc("place_bid", { p_lot: lotId, p_amount: amt });
    if (error) return toast({ description: error.message });
    toast({ description: `Bid placed for $${amt.toFixed(2)}` });
  };

  // Animated confirmation "chip" when new bids arrive
  const [chip, setChip] = useState<TickerBid | null>(null);
  useEffect(() => {
    if (!chip) return;
    const t = setTimeout(() => setChip(null), 2000);
    return () => clearTimeout(t);
  }, [chip]);

  const people = useMemo(() => participants.slice(0, 8), [participants]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Live Auction Room | ZingLots</title>
        <meta name="description" content="Join the live auction: real-time bids, countdown timer, and participant activity." />
        <link rel="canonical" href={`/auction/${lotId}`} />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-12">
        <section className="lg:col-span-8 space-y-4">
          <article className="relative overflow-hidden rounded-lg border bg-card">
            <div className="aspect-video w-full bg-gradient-to-br from-primary/15 via-accent/10 to-background flex items-center justify-center">
              <div className="text-center">
                <div className="mb-2 inline-block rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground">Live Stream</div>
                <h1 className="text-xl font-semibold">Video stream placeholder</h1>
                <p className="text-sm text-muted-foreground">Connect your RTMP stream here</p>
              </div>
            </div>
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs shadow-[var(--shadow-elegant)]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
              {count} live
            </div>
            {chip && (
              <div className="pointer-events-none absolute bottom-3 left-3 animate-enter rounded-full bg-primary px-3 py-1 text-primary-foreground shadow-[var(--shadow-elegant)]">
                +${chip.amount.toFixed(2)} {chip.user_id ? `by Bidder${chip.user_id.slice(0,3)}` : "Bidder"}
              </div>
            )}
          </article>

          {lotId && <LiveLotTicker lotId={lotId} />}

          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Quick Bid</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setDesired((d) => (d == null ? (Number(topBid ?? 0) + 1) : d + 1))}>Bid +$1</Button>
              <Button variant="outline" onClick={() => setDesired((d) => (d == null ? (Number(topBid ?? 0) + 5) : d + 5))}>Bid +$5</Button>
              <div className="ml-2 flex items-center gap-2">
                <label htmlFor="customBid" className="text-sm text-muted-foreground">Custom</label>
                <input
                  id="customBid"
                  value={desired ?? ""}
                  onChange={(e) => setDesired(Number(e.target.value))}
                  inputMode="decimal"
                  className="h-9 w-28 rounded-md border bg-background px-2 text-sm"
                  aria-label="Custom bid amount"
                />
              </div>
              <Button className="ml-auto" onClick={placeBid}>
                Place Bid
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Tip: Use Arrow Up to increase by $1 and Enter to bid.</p>
          </section>
        </section>

        <aside className="lg:col-span-4 space-y-4">
          {lotId && <BidTicker lotId={lotId} onNewBid={setChip} />}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 text-sm font-medium">Participants ({count})</div>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={p.avatar_url ?? undefined} alt={`Participant ${p.id} avatar`} />
                    <AvatarFallback>{(p.name ?? p.id).slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[7rem] truncate">{p.name ?? `User ${p.id.slice(0, 4)}`}</span>
                </div>
              ))}
              {people.length === 0 && <div className="text-xs text-muted-foreground">Waiting for attendees…</div>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
