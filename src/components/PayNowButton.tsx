import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

export function PayNowButton({ orderId, subtotal, feesBps = 1200 }: { orderId: string; subtotal: number; feesBps?: number }) {
  const [loading, setLoading] = useState(false);
  const amountCents = Math.round(Number(subtotal) * 100);

  const onClick = async () => {
    try {
      setLoading(true);
      const sb = getSupabase();
      if (!sb) return toast({ description: "Supabase not configured" });
      const { data, error } = await sb.functions.invoke('checkout-create-session', {
        body: { orderId, amountCents, feeBps: feesBps },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No checkout URL");
      window.location.href = url; // redirect
    } catch (e: any) {
      toast({ description: e.message || 'Checkout error' });
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={loading} aria-disabled={loading}>
      {loading ? 'Redirecting…' : 'Pay now'}
    </Button>
  );
}
