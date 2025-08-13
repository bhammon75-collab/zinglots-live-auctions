import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import lotImage from "@/assets/lot-generic.jpg";
import { Button } from "@/components/ui/button";
import BidPanel from "@/components/auctions/BidPanel";
import { getSupabase } from "@/lib/supabaseClient";

interface LotRow {
  id: string;
  show_id: string;
  title: string;
  category: string;
  start_price: number;
  ends_at: string | null;
  winner_id: string | null;
}

const Evidence = () => (
  <section aria-labelledby="evidence" className="rounded-lg border bg-card p-4">
    <h3 id="evidence" className="text-lg font-semibold">Evidence</h3>
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Set No./Year</dt><dd>71043 / 2018</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Condition</dt><dd>New / Sealed</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Seals</dt><dd>Factory sealed, intact</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Grading</dt><dd>PSA 9 (card)</dd></div>
      </dl>
      <div className="grid grid-cols-3 gap-2">
        <img src={lotImage} alt="Grading photo 1" className="h-24 w-full rounded-md object-cover" />
        <img src={lotImage} alt="Grading photo 2" className="h-24 w-full rounded-md object-cover" />
        <img src={lotImage} alt="Grading photo 3" className="h-24 w-full rounded-md object-cover" />
      </div>
    </div>
  </section>
);

const ProductDetail = () => {
  const { id } = useParams();
  const [lot, setLot] = useState<LotRow | null>(null);
  const [topBid, setTopBid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const sb = getSupabase();
      if (!sb || !id) return;
      setLoading(true);
      const { data: row } = await sb.schema('app').from('lots')
        .select('id, show_id, title, category, start_price, ends_at, winner_id')
        .eq('id', id)
        .maybeSingle();
      if (row) setLot(row as any);

      const { data: bids } = await sb.schema('app').from('bids')
        .select('amount')
        .eq('lot_id', id)
        .order('amount', { ascending: false })
        .limit(1);
      setTopBid(bids && bids.length ? Number(bids[0].amount) : null);
      setLoading(false);
    };
    run();
  }, [id]);

  const bidPanelLot = useMemo(() => {
    if (!lot) return null;
    return {
      id: lot.id,
      auction_id: lot.show_id,
      title: lot.title,
      starting_bid: Number(lot.start_price ?? 0),
      current_price: topBid ?? Number(lot.start_price ?? 0),
      reserve_met: false,
      high_bidder: lot.winner_id ?? null,
    };
  }, [lot, topBid]);

  const bidPanelAuction = useMemo(() => {
    if (!lot) return null;
    return {
      id: lot.show_id,
      ends_at: lot.ends_at,
      soft_close_secs: 120,
    };
  }, [lot]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{lot ? `${lot.title} | ZingLots` : 'Lot | ZingLots'}</title>
        <meta name="description" content={lot ? `Bid on ${lot.title} on ZingLots. Soft-close bidding and Buy Now available.` : 'ZingLots lot'} />
        {id && <link rel="canonical" href={`/product/${id}`} />}
        {lot && (
          <script type="application/ld+json">{JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: lot.title,
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: (topBid ?? Number(lot.start_price ?? 0)).toFixed(2),
              availability: "https://schema.org/InStock",
            },
          })}</script>
        )}
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border">
          <img src={lotImage} alt={lot ? `${lot.title} primary photo` : 'Lot photo'} className="w-full object-cover" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{lot ? lot.title : 'Lot not found'}</h1>
          {lot && <p className="mt-1 text-sm text-muted-foreground">Category: {lot.category}</p>}
          <div className="mt-6">
            {bidPanelLot && bidPanelAuction ? (
              <BidPanel lot={bidPanelLot as any} auction={bidPanelAuction as any} userTier={{ tier: 0, cap: 200 }} isSeller={false} isAdmin={false} />
            ) : (
              !loading && <div className="text-muted-foreground">This lot could not be found.</div>
            )}
          </div>

          <div className="mt-8 space-y-6">
            <Evidence />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetail;
