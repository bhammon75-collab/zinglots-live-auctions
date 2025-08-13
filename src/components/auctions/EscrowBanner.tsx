import { Lock } from 'lucide-react'
export function EscrowBanner({ show }:{ show?: boolean }) {
  if (!show) return null
  return (
    <div className="rounded-xl border bg-muted p-3 text-sm flex items-center gap-2">
      <Lock className="h-4 w-4" />
      Protected by escrow — funds are released after you confirm item condition.
    </div>
  )
}