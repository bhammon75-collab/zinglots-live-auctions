import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";

const Help = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Help & Contact | ZingLots</title>
        <meta name="description" content="Get help with buying, selling, shipping, and account questions on ZingLots." />
        <link rel="canonical" href="/help" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Help & Contact</h1>
          <p className="mt-2 text-muted-foreground">We’re here to help you buy, sell, and zing your next find.</p>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Buying</h2>
            <ul className="mt-3 list-inside list-disc text-sm text-muted-foreground">
              <li>How bidding and Extended bidding work</li>
              <li>Buy Now checkout and payment options</li>
              <li>Returns and refunds</li>
            </ul>
          </article>
          <article className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Selling</h2>
            <ul className="mt-3 list-inside list-disc text-sm text-muted-foreground">
              <li>Create a listing and set pricing</li>
              <li>Shipping labels and tracking</li>
              <li>Seller fees and payouts</li>
            </ul>
          </article>
          <article className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Account & Support</h2>
            <ul className="mt-3 list-inside list-disc text-sm text-muted-foreground">
              <li>Sign in, security, and notifications</li>
              <li>Watchlist & saved searches</li>
              <li>Contact support: support@zinglots.com</li>
            </ul>
          </article>
        </section>

        <aside className="mt-10 rounded-lg border bg-muted/30 p-6">
          <h2 className="text-lg font-semibold">Need more help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Email us at support@zinglots.com and we’ll get back within 1 business day.</p>
        </aside>
      </main>
    </div>
  );
};

export default Help;
