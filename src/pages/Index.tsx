import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import SignatureGlow from "@/components/SignatureGlow";
import CategoryPills from "@/components/CategoryPills";
import LotCard from "@/components/LotCard";
import heroImage from "@/assets/hero-zinglots.jpg";
import { Button } from "@/components/ui/button";
import { DEMO_LOTS, DEMO_SHOWS } from "@/data/demo";
import { Link, useNavigate } from "react-router-dom";
import StripeOnboardSmokeTest from "@/components/StripeOnboardSmokeTest";
import PayPalSmokeTest from "@/components/PayPalSmokeTest";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const showDev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    navigate(`/discover${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };
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

      <main className="min-h-screen">
        {/* Hero section with auction focus */}
        <section className="gradient-hero text-white">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight max-w-3xl">
              Bid. Win. Save.
            </h1>
            <p className="mt-4 text-lg text-white/80 max-w-2xl">
              Real auctions with proxy bidding, anti-snipe soft-close, and secure checkout. Built for power sellers & savvy buyers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="bg-zing-500 hover:bg-zing-600 text-white rounded-xl">
                <Link to="/discover">Browse auctions</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-white/40 text-white hover:bg-white/10">
                <Link to="/discover?endingWithin=1hour">Ending soon</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-white/40 text-white hover:bg-white/10">
                <Link to="/dashboard/seller">Sell now</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-white/80">
              <div>✅ Proxy bidding</div>
              <div>⏱ Soft-close (+2:00)</div>
              <div>🛡️ Escrow on high-value</div>
              <div>✔️ Verified sellers</div>
            </div>
            
            {/* Search bar moved under hero text */}
            <div className="mt-12 max-w-2xl">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Input
                  type="text"
                  placeholder="Search for collectibles..."
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full h-14 pl-4 pr-12 text-lg bg-white text-black border-0 rounded-xl"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="absolute right-2 top-2 bg-zing-500 hover:bg-zing-600 rounded-lg"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </form>
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
