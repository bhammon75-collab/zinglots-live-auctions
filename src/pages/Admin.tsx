import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

interface PayoutRow { id: string; order_id: string; seller_id: string; amount: number; status: string; }

const Admin = () => {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  const refresh = async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('payouts').select('id, order_id, seller_id, amount, status').eq('status', 'pending').order('created_at', { ascending: false });
    setPayouts((data as any) || []);
  };

  useEffect(() => { refresh(); }, []);

  const settle = async (orderId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.functions.invoke('admin-settle', { body: { orderId } });
    await refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin | ZingLots</title>
        <meta name="description" content="Verify sellers, manage disputes, and platform settings." />
        <link rel="canonical" href="/admin" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
        <section className="md:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold">Pending Payouts</h2>
            <div className="space-y-2 mt-2">
              {payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending payouts.</p>
              ) : payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">Order {p.order_id.slice(0,8)}…</div>
                    <div className="text-muted-foreground">Seller {p.seller_id.slice(0,8)}… · Amount ${Number(p.amount).toFixed(2)}</div>
                  </div>
                  <Button onClick={() => settle(p.order_id)}>Settle Payout</Button>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold">Disputes & Refunds</h2>
            <p className="text-sm text-muted-foreground">Timers, evidence, resolutions, and refunds.</p>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Risk Tools</h2>
            <p className="text-sm text-muted-foreground">Flag counterfeit risk and ban accounts if needed.</p>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default Admin;
