import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { DEMO_SHOWS } from "@/data/demo";

const Shows = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Shows | ZingLots Live Toy Auctions</title>
        <meta name="description" content="Upcoming and past ZingLots live toy shows. Follow sellers and set reminders." />
        <link rel="canonical" href="/shows" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold">Live Shows</h1>
        <p className="mt-2 text-muted-foreground">Catch the next drop and bid live.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_SHOWS.map((s) => (
            <article key={s.id} className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.when} · {s.lots} lots</p>
              <div className="mt-3 flex gap-3">
                <a href={`/shows`} className="text-sm text-primary underline-offset-4 hover:underline">View show</a>
                <button className="text-sm text-muted-foreground hover:text-foreground">Follow</button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Shows;
