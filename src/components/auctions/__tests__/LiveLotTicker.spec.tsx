import { render } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'
import React from 'react'

vi.mock('@/hooks/useLotRealtime', () => ({
  useLotRealtime: () => ({
    status: 'running',
    endsAt: '2030-01-01T00:02:00Z',
    reserveMet: true,
    topBid: 123.45,
  }),
}))

import LiveLotTicker from '../LiveLotTicker'

describe('LiveLotTicker', () => {
  it('renders LIVE, reserve chip, price and ends time', () => {
    const { getByText } = render(<LiveLotTicker lotId="L1" startingBid={50} />)
    expect(getByText(/LIVE/i)).toBeInTheDocument()
    expect(getByText(/Reserve met/i)).toBeInTheDocument()
    expect(getByText(/\$123\.45/)).toBeInTheDocument()
  })
})
