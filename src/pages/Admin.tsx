import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";

const Admin = () => {
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
            <h2 className="font-semibold">Seller Verification</h2>
            <p className="text-sm text-muted-foreground">Review KYC submissions and approvals.</p>
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
