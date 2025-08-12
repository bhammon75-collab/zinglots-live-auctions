import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

const PayPalSmokeTest = () => {
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);

  const createOrder = async () => {
    try {
      setLoading(true);
      const sb = getSupabase();
      if (!sb) return toast({ description: "Supabase not configured" });
      const { data, error } = await sb.functions.invoke("paypal-create-order", {
        body: { amount: 1.55, currency: "USD", description: "Dev test order" },
      });
      if (error) throw error;
      const { id, approveUrl } = (data || {}) as any;
      if (!id) throw new Error("No order id returned");
      setOrderId(id);
      setApproveUrl(approveUrl || null);
      toast({ description: `Order created: ${id}` });
    } catch (e: any) {
      toast({ description: e.message || "Create order failed" });
    } finally {
      setLoading(false);
    }
  };

  const captureOrder = async () => {
    try {
      if (!orderId) return toast({ description: "No order to capture" });
      setLoading(true);
      const sb = getSupabase();
      if (!sb) return toast({ description: "Supabase not configured" });
      const { data, error } = await sb.functions.invoke("paypal-capture-order", {
        body: { orderId },
      });
      if (error) throw error;
      toast({ description: "Capture success" });
      console.log("PayPal capture result", data);
    } catch (e: any) {
      toast({ description: e.message || "Capture failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-lg border bg-card/90 p-3 shadow-[var(--shadow-elevate)] backdrop-blur">
      <div className="mb-2 text-xs text-muted-foreground">PayPal Smoke Test</div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={createOrder} disabled={loading} aria-disabled={loading}>
          {loading ? "Working…" : "Create $1.55 Order"}
        </Button>
        <Button size="sm" variant="default" onClick={captureOrder} disabled={loading || !orderId} aria-disabled={loading || !orderId}>
          Capture
        </Button>
      </div>
      {orderId && (
        <div className="mt-2 text-xs text-muted-foreground">
          id: <span className="font-mono">{orderId}</span>
        </div>
      )}
      {approveUrl && (
        <div className="mt-2">
          <a className="text-sm underline" href={approveUrl} target="_blank" rel="noreferrer">
            Approve in PayPal →
          </a>
        </div>
      )}
    </div>
  );
};

export default PayPalSmokeTest;
