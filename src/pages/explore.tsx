import * as React from 'react'
import { supabase } from '@/integrations/supabase/client'
import LotCard from '@/components/auctions/LotCard'
import type { AuctionFilters } from '@/types/filters'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Helmet } from 'react-helmet-async'
import ZingNav from '@/components/ZingNav'

export default function ExplorePage() {
  const [filters, setFilters] = React.useState<AuctionFilters>({ endingWithin: '24hours' })
  const [lots, setLots] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('search_lots', { p: filters as any })
      if (error) throw error
      setLots(data ?? [])
    } catch (err) {
      console.error('Failed to load lots:', err)
      setLots([])
    }
    setLoading(false)
  }
  
  React.useEffect(() => { load() }, [])

  return (
    <>
      <Helmet>
        <title>Explore Auctions - ZingLots</title>
        <meta name="description" content="Browse live auctions ending soon. Find collectibles, toys, trading cards and more at great prices." />
      </Helmet>
      <ZingNav />
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Explore Auctions</h1>
        
        <div className="flex items-end gap-2 flex-wrap mb-6">
          <Input placeholder="Search titles…" className="w-60"
            value={filters.search ?? ''} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          <select className="border rounded px-2 py-1 h-10"
            value={filters.endingWithin ?? ''} onChange={e => setFilters({ ...filters, endingWithin: e.target.value as any })}>
            <option value="">Any time</option>
            <option value="1hour">Ending in 1 hour</option>
            <option value="6hours">Ending in 6 hours</option>
            <option value="24hours">Ending in 24 hours</option>
          </select>
          <Input placeholder="Min $" type="number" step="0.01" className="w-28"
            onChange={e => setFilters({ ...filters, priceRange: { ...(filters.priceRange||{}), min: e.target.value ? Number(e.target.value) : undefined } })} />
          <Input placeholder="Max $" type="number" step="0.01" className="w-28"
            onChange={e => setFilters({ ...filters, priceRange: { ...(filters.priceRange||{}), max: e.target.value ? Number(e.target.value) : undefined } })} />
          <Button onClick={load} className="bg-zing-500 hover:bg-zing-600 text-white rounded-xl">Apply</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? Array.from({length:8}).map((_,i)=>(
            <div key={i} className="h-60 rounded-2xl border bg-muted animate-pulse" />
          )) : lots.length > 0 ? lots.map((l:any)=>(
            <LotCard key={l.id} {...l} />
          )) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No auctions found. Try adjusting your filters.
            </div>
          )}
        </div>
      </div>
    </>
  )
}