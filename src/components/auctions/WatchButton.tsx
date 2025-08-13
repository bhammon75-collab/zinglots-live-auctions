import * as React from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WatchButton({ lotId, initialWatching=false, onChange }:{
  lotId: string; initialWatching?: boolean; onChange?: (watching:boolean)=>void
}) {
  const [watching, setWatching] = React.useState(initialWatching)
  const [busy, setBusy] = React.useState(false)
  
  async function toggle(){
    if (busy) return
    setBusy(true)
    const rpc = watching ? 'unwatch_lot' : 'watch_lot'
    const { error } = await supabase.rpc(rpc, { p_lot: lotId })
    setBusy(false)
    if (!error){ setWatching(!watching); onChange?.(!watching) }
  }
  return (
    <Button variant={watching ? 'secondary' : 'outline'} onClick={toggle} disabled={busy} title="Watch this lot">
      <Star className="mr-2 h-4 w-4" /> {watching ? 'Watching' : 'Watch'}
    </Button>
  )
}