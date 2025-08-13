import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ShippingTrackingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { carrier: string; tracking_number: string; tracking_url?: string }) => Promise<void> | void;
};

export default function ShippingTrackingDialog({ open, onOpenChange, onSubmit }: ShippingTrackingDialogProps) {
  const [carrier, setCarrier] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ carrier, tracking_number: tracking, tracking_url: url || undefined });
      setCarrier("");
      setTracking("");
      setUrl("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add tracking</DialogTitle>
          <DialogDescription>Provide a carrier and tracking number to mark this order as shipped.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm">Carrier</label>
            <Input placeholder="USPS, UPS, FedEx…" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Tracking number</label>
            <Input placeholder="1Z… / 94…" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Tracking URL (optional)</label>
            <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !carrier || !tracking} aria-disabled={loading || !carrier || !tracking}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
