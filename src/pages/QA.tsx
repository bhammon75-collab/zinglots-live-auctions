import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import LiveLotTicker from "@/components/LiveLotTicker";

const QA = () => {
  const [lotId, setLotId] = useState("");
  const [showId, setShowId] = useState("");

  const placeSampleBid = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return toast({ description: "Sign in first" });
    const { data, error } = await supabase.rpc("app.place_bid", { p_lot: lotId, p_bidder: user.user.id, p_amount: 12.34 });
    if (error) return toast({ description: error.message });
    toast({ description: `Bid placed: $${data?.[0]?.new_amount ?? ""}` });
  };

  const shortenSoftClose = async () => {
    const { error } = await supabase.from("app.lots").update({ ends_at: new Date(Date.now() + 10_000).toISOString() }).eq("id", lotId);
    if (error) return toast({ description: error.message });
    toast({ description: "ends_at set to 10s from now (if you have permission)" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>QA Harness | ZingLots</title>
        <meta name="description" content="Test soft-close, bids, and realtime for ZingLots." />
        <link rel="canonical" href="/qa" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10 space-y-6">
        <h1 className="text-3xl font-bold">QA Harness</h1>
        <p className="text-sm text-muted-foreground">Use in two browsers to demo bidding + soft-close.</p>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="rounded-md border bg-background px-3 py-2" placeholder="Lot ID" value={lotId} onChange={(e) => setLotId(e.target.value)} />
            <input className="rounded-md border bg-background px-3 py-2" placeholder="Show ID" value={showId} onChange={(e) => setShowId(e.target.value)} />
          </div>
          {lotId && <LiveLotTicker lotId={lotId} />}
          <div className="flex gap-3">
            <Button onClick={placeSampleBid}>Place Sample Bid ($12.34)</Button>
            <Button variant="outline" onClick={shortenSoftClose}>Shorten Soft-Close (10s)</Button>
          </div>
        </div>

        <aside className="text-xs text-muted-foreground">
          Seeds: see docs/migrations/0003_seed_demo.sql. Legal: Collectibles intended for ages 14+.
        </aside>
      </main>
    </div>
  );
};

export default QA;
