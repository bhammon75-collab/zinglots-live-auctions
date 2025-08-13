import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import SignatureGlow from "@/components/SignatureGlow";
import CategoryPills from "@/components/CategoryPills";
import LotCard from "@/components/LotCard";
import heroImage from "@/assets/hero-zinglots.jpg";
import { Button } from "@/components/ui/button";
import { DEMO_LOTS, DEMO_SHOWS } from "@/data/demo";
import { Link } from "react-router-dom";
import StripeOnboardSmokeTest from "@/components/StripeOnboardSmokeTest";
import PayPalSmokeTest from "@/components/PayPalSmokeTest";

const Index = () => {
  const showDev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>ZingLots | Live Toy Auctions & Shows</title>
        <meta name="description" content="The marketplace where collectors buy, sell, and discover rare collectibles. Auction-style bidding, instant Buy Now, and secure checkout." />
        <link rel="canonical" href="/" />
        <meta property="og:title" content="ZingLots | Live Toy Auctions" />
        <meta property="og:description" content="Discover live shows and bid on collectible toys with soft-close and Buy Now." />
      </Helmet>

      <ZingNav />
      {showDev && (<>
        <StripeOnboardSmokeTest />
        <PayPalSmokeTest />
      </>)}

      <main>
        {/* Hero */}
        <section className="relative">
          <div className="container mx-auto grid items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-16">
            <div className="relative">
              <SignatureGlow />
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Zing your next find.</h1>
              <p className="mt-3 max-w-prose text-lg text-muted-foreground">
                The marketplace where collectors buy, sell, and discover rare collectibles. Auction-style bidding, instant Buy Now, and secure checkout.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="hero" size="xl" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                  <Link to="/discover">Shop Now</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/category/tcg">Explore TCG</Link>
                </Button>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Join 50K+ collectors finding deals daily
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border shadow-[var(--shadow-elevate)]">
              <img src={heroImage} alt="ZingLots marketplace for collectibles hero" className="h-full w-full object-cover" />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section aria-labelledby="categories" className="border-t bg-card/40">
          <div className="container mx-auto px-4 py-6">
            <h2 id="categories" className="sr-only">Categories</h2>
            <CategoryPills />
          </div>
        </section>

        {/* Discovery Feed */}
        <section aria-labelledby="discover" className="">
          <div className="container mx-auto px-4 py-10">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 id="discover" className="text-2xl font-bold">Discover Lots</h2>
                <p className="text-sm text-muted-foreground">Fresh picks across categories</p>
              </div>
              <Button variant="ghost" asChild>
                <Link to="/discover">See all</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {DEMO_LOTS.slice(0, 12).map((item) => (
                <Link to={`/product/${item.id}`} key={item.id} aria-label={item.title}>
                  <LotCard item={item} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
