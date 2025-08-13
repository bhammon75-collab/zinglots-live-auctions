import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { DEMO_LOTS } from "@/data/demo";
import LotCard from "@/components/LotCard";
import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/categories";
import { Link } from "react-router-dom";

const Discover = () => {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [view, setView] = useState<"all" | "new" | "ending" | "priceDrops">("all");

  const filtered = useMemo(() => {
    const toCents = (v: string) => (v ? Math.round(parseFloat(v) * 100) : undefined);
    const minC = toCents(min);
    const maxC = toCents(max);

    return DEMO_LOTS.filter((item) => {
      if (q && !item.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (category) {
        if (item.category !== category) return false;
      }
      if (typeof minC === "number" && item.currentBid < minC) return false;
      if (typeof maxC === "number" && item.currentBid > maxC) return false;
      if (view === "priceDrops" && !item.buyNow) return false;
      if (view === "ending") {
        // naive: everything ending within 24h (demo data is minutes)
        return true;
      }
      return true;
    });
  }, [q, category, min, max, view]);

  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("recently_viewed");
      setRecent(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  const recentLots = useMemo(() => DEMO_LOTS.filter((l) => recent.includes(l.id)), [recent]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Discover | ZingLots</title>
        <meta name="description" content="Browse trending marketplace listings, filter by category and price, and find deals today." />
        <link rel="canonical" href="/discover" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discover</h1>
            <p className="mt-2 text-muted-foreground">Trending across categories</p>
          </div>
          <form className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search collectibles"
              className="md:w-[280px]"
              aria-label="Search"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.name}>{c.name}</option>
              ))}
            </select>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Min $"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="md:w-[120px]"
              aria-label="Min price"
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Max $"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="md:w-[120px]"
              aria-label="Max price"
            />
            <select
              value={view}
              onChange={(e) => setView(e.target.value as any)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="View"
            >
              <option value="all">All</option>
              <option value="new">New Today</option>
              <option value="ending">Ending Soon</option>
              <option value="priceDrops">Price Drops</option>
            </select>
            <Button type="button" variant="ghost" onClick={() => { setQ(""); setCategory(""); setMin(""); setMax(""); setView("all"); }}>
              Reset
            </Button>
          </form>
        </header>

        <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <Link to={`/product/${item.id}`} key={item.id} aria-label={item.title}>
              <LotCard item={item} />
            </Link>
          ))}
        </div>

        {recentLots.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold">Recently viewed</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {recentLots.map((item) => (
                <Link to={`/product/${item.id}`} key={item.id} aria-label={item.title}>
                  <LotCard item={item} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Discover;
