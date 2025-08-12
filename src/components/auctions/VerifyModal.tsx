import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type VerifyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStripeIdentity?: () => void;
  onManualUpload?: () => void;
};

export function VerifyModal({ open, onOpenChange, onStripeIdentity, onManualUpload }: VerifyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="verify-modal">
        <DialogHeader>
          <DialogTitle>Increase your bidding limit</DialogTitle>
          <DialogDescription>
            Tiered verification protects buyers and sellers. Complete verification to raise your cap.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Tier 0: Phone + card on file — cap $200</li>
          <li>Tier 1: Phone + card + address — cap $1,000</li>
          <li>Tier 2: Stripe Identity or manual review — no cap</li>
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={onManualUpload}>Upload ID (manual)</Button>
          <Button onClick={onStripeIdentity}>Verify with Stripe Identity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
