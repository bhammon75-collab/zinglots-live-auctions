import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useParams } from "react-router-dom";
import { CATEGORIES, DEMO_LOTS } from "@/data/demo";
import LotCard from "@/components/LotCard";

const Category = () => {
  const { slug } = useParams();
  const cat = CATEGORIES.find((c) => c.slug === slug);
  const title = cat?.name ?? "Category";
  const lots = DEMO_LOTS.filter((l) => l.category.toLowerCase().replace(/\s+/g, '-') === slug);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title} | ZingLots</title>
        <meta name="description" content={`Bid on ${title} lots on ZingLots.`} />
        <link rel="canonical" href={`/category/${slug}`} />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">Browse active and upcoming lots.</p>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lots.map((item) => (
            <a href={`/product/${item.id}`} key={item.id} aria-label={item.title}>
              <LotCard item={item} />
            </a>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Category;
