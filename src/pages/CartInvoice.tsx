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

const CartInvoice = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Cart & Invoice | ZingLots</title>
        <meta name="description" content="Review your Buy Now items and invoices. Secure checkout with Stripe." />
        <link rel="canonical" href="/cart" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold">Cart & Invoice</h1>
        <p className="mt-2 text-muted-foreground">Your Buy Now items and open invoices will appear here.</p>

        <section className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-3">Unpaid Invoices</h2>
          {invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">No unpaid invoices.</div>
          ) : (
            <div className="space-y-3">
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
        </section>

        <section className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-3">Paid / Awaiting Shipment</h2>
          <div className="space-y-3">
            {paid.filter(o => !o.shipping_tracking).map(o => (
              <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium">Order {o.id.slice(0,8)}…</div>
                <div className="text-muted-foreground">Paid ${Number(o.subtotal).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-3">Shipped / Tracking</h2>
          <div className="space-y-3">
            {paid.filter(o => !!o.shipping_tracking).length === 0 ? (
              <div className="text-sm text-muted-foreground">No shipments yet.</div>
            ) : (
              paid.filter(o => !!o.shipping_tracking).map(o => (
                <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="font-medium">Order {o.id.slice(0,8)}…</div>
                  <div className="text-muted-foreground">Carrier {o.shipping_carrier} · Tracking {o.shipping_tracking}</div>
                  {o.label_url && (
                    <a href={o.label_url} target="_blank" rel="noreferrer" className="underline">View Label</a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default CartInvoice;
