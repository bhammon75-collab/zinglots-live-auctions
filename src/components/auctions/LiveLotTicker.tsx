import React, { useMemo } from 'react'
import { useLotRealtime } from '@/hooks/useLotRealtime'
import type { LotStatus } from '@/types/auction'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Props = {
  lotId: string
  startingBid: number
  className?: string
}

function statusLabel(s?: LotStatus) {
  switch (s) {
    case 'running':
    case 'live':
      return 'LIVE'
    case 'queued':
      return 'UP NEXT'
    case 'ended':
    case 'settled':
      return 'ENDED'
    case 'settling':
      return 'SETTLING'
    default:
      return '—'
  }
}

export default function LiveLotTicker({ lotId, startingBid, className }: Props) {
  const { status, endsAt, reserveMet, topBid } = useLotRealtime(lotId)

  const price = useMemo(() => {
    const n = typeof topBid === 'number' ? topBid : startingBid
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
  }, [topBid, startingBid])

  const endsShort = endsAt ? new Date(endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className={className ?? 'flex items-center gap-3'}>
      <Badge variant={status === 'running' || status === 'live' ? 'destructive' : 'secondary'}>
        {statusLabel(status)}
      </Badge>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={reserveMet ? 'default' : 'outline'}>
              {reserveMet ? 'Reserve met ✅' : 'Reserve not met'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reserve is only revealed as met/not met—amount is hidden.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="text-sm tabular-nums">
        <span className="text-muted-foreground mr-1">Current:</span>
        <span>{price}</span>
        <span className="mx-2">•</span>
        <span className="text-muted-foreground mr-1">Ends:</span>
        <span>{endsShort}</span>
      </div>
    </div>
  )
}
