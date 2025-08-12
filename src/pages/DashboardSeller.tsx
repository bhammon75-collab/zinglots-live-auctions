import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";

const DashboardSeller = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Seller Dashboard | ZingLots</title>
        <meta name="description" content="Manage lots, shows, KYC, and payouts on ZingLots." />
        <link rel="canonical" href="/dashboard/seller" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
        <section className="md:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold">Seller Console</h1>
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold">KYC & Stripe Connect</h2>
            <p className="text-sm text-muted-foreground">Verify your identity and connect payouts to start selling.</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold">Your Lots</h2>
            <p className="text-sm text-muted-foreground">Create, schedule, and manage lots here.</p>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Upcoming Shows</h2>
            <p className="text-sm text-muted-foreground">Schedule a show to showcase multiple lots live.</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Fees</h2>
            <p className="text-sm text-muted-foreground">Global fee tiers 8–15%. Category surcharges apply.</p>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default DashboardSeller;
