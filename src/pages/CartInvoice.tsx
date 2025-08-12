import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";

const CartInvoice = () => {
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
        <div className="mt-6 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No items yet. Discover something amazing on the home page.
        </div>
      </main>
    </div>
  );
};

export default CartInvoice;
