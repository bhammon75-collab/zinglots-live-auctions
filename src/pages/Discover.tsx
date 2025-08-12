import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { DEMO_LOTS } from "@/data/demo";
import LotCard from "@/components/LotCard";

const Discover = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Discover | ZingLots</title>
        <meta name="description" content="Browse trending toy auction lots on ZingLots." />
        <link rel="canonical" href="/discover" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold">Discover</h1>
        <p className="mt-2 text-muted-foreground">Trending across categories</p>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DEMO_LOTS.map((item) => (
            <a href={`/product/${item.id}`} key={item.id}>
              <LotCard item={item} />
            </a>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Discover;
