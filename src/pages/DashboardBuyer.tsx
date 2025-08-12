import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";

const DashboardBuyer = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Buyer Dashboard | ZingLots</title>
        <meta name="description" content="Track bids, invoices, and follows on ZingLots." />
        <link rel="canonical" href="/dashboard/buyer" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
        <section className="md:col-span-2">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <div className="mt-4 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Your active bids and watchlist will display here once you sign in.
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Invoices</h2>
            <p className="text-sm text-muted-foreground">No open invoices.</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Following</h2>
            <p className="text-sm text-muted-foreground">Follow sellers and shows to get alerts.</p>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default DashboardBuyer;
