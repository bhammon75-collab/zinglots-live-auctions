import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "@/lib/supabaseClient";

interface OrderRow {
  id: string;
  status: 'invoiced'|'paid'|'shipped'|'settled'|'refunded';
  subtotal: number;
  fees_bps: number;
  shipping_cents: number;
  shipping_tracking: string | null;
  shipping_carrier: string | null;
  label_url: string | null;
}

const DashboardSeller = () => {
  const [sellerInfo, setSellerInfo] = useState<{ verified: boolean; hasStripe: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paidOrders, setPaidOrders] = useState<OrderRow[]>([]);

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

        // Attempt to fetch paid orders for this seller (allowed if admin via RLS policy)
        const { data: orders } = await sb
          .from('app.orders')
          .select('id, status, subtotal, fees_bps, shipping_cents, shipping_tracking, shipping_carrier, label_url, lot_id')
          .eq('status', 'paid');
        setPaidOrders(((orders as any) || []));
      } catch {
        setSellerInfo(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const canGoLive = !!(sellerInfo?.verified && sellerInfo?.hasStripe);

  const createLabel = async (orderId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.functions.invoke('shipping-create-label', { body: { orderId } });
    if (!error) {
      // Refresh list
      const { data: orders } = await sb
        .from('app.orders')
        .select('id, status, subtotal, fees_bps, shipping_cents, shipping_tracking, shipping_carrier, label_url, lot_id')
        .eq('status', 'paid');
      setPaidOrders(((orders as any) || []));
    }
  };

  const netDue = (o: OrderRow) => {
    const fee = (o.fees_bps / 10000) * Number(o.subtotal);
    return (Number(o.subtotal) - fee).toFixed(2);
  };

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
              <Button disabled={!canGoLive} aria-disabled={!canGoLive}>Go Live</Button>
              <Button variant="outline" disabled={!canGoLive} aria-disabled={!canGoLive}>Start Lot</Button>
            </div>
            {!loading && !canGoLive && (
              <p className="mt-2 text-xs text-muted-foreground">
                Finish onboarding to go live → <Link to="/dashboard/seller" className="underline">Seller Dashboard</Link>
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold">Paid Orders</h2>
            <div className="space-y-2 mt-2">
              {paidOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No paid orders yet (or insufficient permissions).</p>
              ) : paidOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">Order {o.id.slice(0,8)}…</div>
                    <div className="text-muted-foreground">Net due to you ${netDue(o)}{o.shipping_cents ? ` · Shipping $${(o.shipping_cents/100).toFixed(2)}` : ''}</div>
                    {o.shipping_tracking ? (
                      <div className="text-muted-foreground">{o.shipping_carrier} · {o.shipping_tracking} {o.label_url && (<a href={o.label_url} target="_blank" rel="noreferrer" className="underline ml-2">View Label</a>)}</div>
                    ) : null}
                  </div>
                  {!o.shipping_tracking ? (
                    <Button onClick={() => createLabel(o.id)}>Create Label</Button>
                  ) : null}
                </div>
              ))}
            </div>
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
