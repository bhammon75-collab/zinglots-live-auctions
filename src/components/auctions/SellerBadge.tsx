import { ShieldCheck } from 'lucide-react'
export function SellerBadge({ verified }:{ verified?: boolean }) {
  if (!verified) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <ShieldCheck className="h-3.5 w-3.5" /> Verified seller
    </span>
  )
}