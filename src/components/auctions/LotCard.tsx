import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { CountdownPill } from './CountdownPill'
import { WatchButton } from './WatchButton'
import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'

type LotCardProps = {
  id: string
  title: string
  image_url?: string | null
  ends_at: string
  reserve_met: boolean
  current_price: number | null
  starting_bid: number | null
  watchers?: number
}

export default function LotCard(props: LotCardProps) {
  const price = props.current_price ?? props.starting_bid ?? 0
  const priceLabel = props.current_price ? `Current: $${price.toFixed(2)}` : `Starting bid: $${price.toFixed(2)}`
  
  return (
    <Link to={`/product/${props.id}`} className="group block rounded-2xl border bg-card shadow-card hover:shadow-lg transition-shadow">
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-muted">
        {props.image_url
          ? <img src={props.image_url} alt={props.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" />
          : <div className="h-full w-full grid place-items-center text-sm text-muted-foreground">No image</div>}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant={props.reserve_met ? 'default' : 'outline'}>
            {props.reserve_met ? 'Reserve met ✅' : 'Reserve not met'}
          </Badge>
        </div>
        <div className="absolute right-3 bottom-3">
          <CountdownPill endsAt={props.ends_at} />
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="line-clamp-2 font-medium">{props.title}</div>
        <div className="flex items-center justify-between text-sm">
          <div>{priceLabel}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>{props.watchers ?? 0} watching</span>
          </div>
        </div>
        <div className="pt-1">
          <div onClick={(e)=>e.preventDefault()}>
            <WatchButton lotId={props.id} />
          </div>
        </div>
      </div>
    </Link>
  )
}