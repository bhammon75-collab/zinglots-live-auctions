import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useParams } from "react-router-dom";
import { DEMO_LOTS } from "@/data/demo";
import lotImage from "@/assets/lot-generic.jpg";
import { Button } from "@/components/ui/button";

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
  const lot = DEMO_LOTS.find((l) => l.id === id) ?? DEMO_LOTS[0];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{lot.title} | ZingLots</title>
        <meta name="description" content={`Bid on ${lot.title} on ZingLots. Soft-close bidding and Buy Now available.`} />
        <link rel="canonical" href={`/product/${lot.id}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: lot.title,
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (lot.currentBid/100).toFixed(2),
            availability: "https://schema.org/InStock",
          },
        })}</script>
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border">
          <img src={lotImage} alt={`${lot.title} primary photo`} className="w-full object-cover" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{lot.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Category: {lot.category}</p>
          <div className="mt-4 flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Current bid</div>
              <div className="text-2xl font-semibold">${(lot.currentBid/100).toFixed(2)}</div>
            </div>
            {lot.buyNow && (
              <Button variant="outline">Buy Now ${(lot.buyNow/100).toFixed(2)}</Button>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="hero" size="lg">Place Bid</Button>
            <Button variant="ghost">Add to Watchlist</Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Soft-close enabled · Ends in {lot.endsIn}</p>

          <div className="mt-8 space-y-6">
            <Evidence />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetail;
