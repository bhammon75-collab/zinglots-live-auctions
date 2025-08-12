import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "@/lib/supabaseClient";
const DashboardSeller = () => {
  const [sellerInfo, setSellerInfo] = useState<{ verified: boolean; hasStripe: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const sb = getSupabase();
        if (!sb) { setSellerInfo(null); setLoading(false); return; }
        const { data: u } = await sb.auth.getUser();
        const uid = u.user?.id;
        if (!uid) { setSellerInfo(null); setLoading(false); return; }
        const { data, error } = await sb
          .from('app.sellers')
          .select('kyc_status, stripe_account_id')
          .eq('id', uid)
          .maybeSingle();
        if (error) throw error;
        const verified = (data as any)?.kyc_status === 'verified';
        const hasStripe = Boolean((data as any)?.stripe_account_id);
        setSellerInfo({ verified, hasStripe });
      } catch {
        setSellerInfo(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

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
            <div className="mt-4 flex gap-3">
              <Button disabled={!(sellerInfo?.verified && sellerInfo?.hasStripe)} aria-disabled={!(sellerInfo?.verified && sellerInfo?.hasStripe)}>Go Live</Button>
              <Button variant="outline" disabled={!(sellerInfo?.verified && sellerInfo?.hasStripe)} aria-disabled={!(sellerInfo?.verified && sellerInfo?.hasStripe)}>Start Lot</Button>
            </div>
            {!loading && !(sellerInfo?.verified && sellerInfo?.hasStripe) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Finish onboarding to go live → <Link to="/dashboard/seller" className="underline">Seller Dashboard</Link>
              </p>
            )}
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
