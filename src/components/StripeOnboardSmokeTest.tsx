import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

const StripeOnboardSmokeTest = () => {
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    try {
      setLoading(true);
      const sb = getSupabase();
      if (!sb) {
        toast({ description: "Supabase not configured" });
        setLoading(false);
        return;
      }
      const sellerId = `smoke-${Date.now()}`;
      const { data, error } = await sb.functions.invoke("stripe-connect-onboard", {
        body: {},
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No onboarding URL returned");
      toast({ description: `Onboarding URL created for ${sellerId}` });
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ description: e.message || "Stripe onboard test failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-card/90 p-3 shadow-[var(--shadow-elevate)] backdrop-blur">
      <div className="mb-2 text-xs text-muted-foreground">Stripe Onboard Smoke Test</div>
      <Button size="sm" variant="secondary" onClick={runTest} disabled={loading} aria-disabled={loading}>
        {loading ? "Testing…" : "Run Test"}
      </Button>
    </div>
  );
};

export default StripeOnboardSmokeTest;
