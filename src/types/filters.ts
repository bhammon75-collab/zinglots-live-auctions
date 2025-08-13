export interface AuctionFilters {
  category?: string[]
  priceRange?: { min?: number; max?: number }
  endingWithin?: '1hour' | '6hours' | '24hours'
  auctionType?: 'online' | 'live' | 'webcast'
  search?: string
}