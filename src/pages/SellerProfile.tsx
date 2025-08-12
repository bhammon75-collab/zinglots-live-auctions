import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useParams } from "react-router-dom";
import { DEMO_SELLERS, DEMO_LOTS } from "@/data/demo";
import LotCard from "@/components/LotCard";

const SellerProfile = () => {
  const { id } = useParams();
  const seller = DEMO_SELLERS.find((s) => s.id === id) ?? { id: id || "", name: "Seller" };
  const lots = DEMO_LOTS.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{seller.name} | Seller on ZingLots</title>
        <meta name="description" content={`View ${seller.name}'s upcoming shows and lots on ZingLots.`} />
        <link rel="canonical" href={`/seller/${seller.id}`} />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">{seller.name}</h1>
            <p className="text-muted-foreground">Trusted seller · 4.9 rating</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border px-4 py-2 text-sm">Follow</button>
            <a href={`/shows`} className="text-sm text-primary underline-offset-4 hover:underline">Upcoming Shows</a>
          </div>
        </div>

        <h2 className="mt-8 text-xl font-semibold">Featured Lots</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lots.map((item) => (
            <a href={`/product/${item.id}`} key={item.id}>
              <LotCard item={item} />
            </a>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SellerProfile;
