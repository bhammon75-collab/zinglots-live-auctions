import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { PayNowButton } from "@/components/PayNowButton";

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

const DashboardBuyer = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const { data } = await sb
        .from('app.orders')
        .select('id, status, subtotal, fees_bps, shipping_cents, shipping_tracking, shipping_carrier, label_url')
        .eq('buyer_id', u.user.id)
        .order('created_at', { ascending: false });
      setOrders((data as any) || []);
    })();
  }, []);

  const invoices = orders.filter(o => o.status === 'invoiced');
  const paid = orders.filter(o => o.status === 'paid');
  const shipped = paid.filter(o => !!o.shipping_tracking);
  const awaiting = paid.filter(o => !o.shipping_tracking);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Buyer Dashboard | ZingLots</title>
        <meta name="description" content="Track bids, invoices, and follows on ZingLots." />
        <link rel="canonical" href="/dashboard/buyer" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
        <section className="md:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold">Welcome back</h1>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-2">Unpaid Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open invoices.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="text-sm">
                      <div className="font-medium">Order {o.id.slice(0,8)}…</div>
                      <div className="text-muted-foreground">Subtotal ${Number(o.subtotal).toFixed(2)}</div>
                    </div>
                    <PayNowButton orderId={o.id} subtotal={Number(o.subtotal)} feesBps={o.fees_bps} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-2">Paid / Awaiting Shipment</h2>
            {awaiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <div className="space-y-2">
                {awaiting.map(o => (
                  <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="font-medium">Order {o.id.slice(0,8)}…</div>
                    <div className="text-muted-foreground">Paid ${Number(o.subtotal).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-2">Shipped / Tracking</h2>
            {shipped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shipments yet.</p>
            ) : (
              <div className="space-y-2">
                {shipped.map(o => (
                  <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="font-medium">Order {o.id.slice(0,8)}…</div>
                    <div className="text-muted-foreground">Carrier {o.shipping_carrier} · Tracking {o.shipping_tracking}</div>
                    {o.label_url && (
                      <a href={o.label_url} target="_blank" rel="noreferrer" className="underline">View Label</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <aside className="space-y-4">
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
