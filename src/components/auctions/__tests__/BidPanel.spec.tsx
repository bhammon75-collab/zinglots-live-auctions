import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import BidPanel from '../BidPanel'

// Toast mock
const toastSpy = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))

// Realtime mock (mutable state)
let realtimeState: any = { endsAt: '2030-01-01T00:00:00Z', reserveMet: false, topBid: null, highBidder: null }
vi.mock('@/hooks/useLotRealtime', () => ({ useLotRealtime: () => realtimeState }))

// Supabase mock
const rpcMock = vi.fn()
const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
vi.mock('@/lib/supabaseClient', () => ({
  getSupabase: () => ({
    rpc: rpcMock,
    auth: { getUser: getUserMock, getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
    removeChannel: () => {}
  })
}))

const baseProps = {
  lot: { id: 'L1', auction_id: 'A1', title: 'Lot', starting_bid: 50, current_price: null, reserve_met: false, high_bidder: null },
  auction: { id: 'A1', ends_at: '2030-01-01T00:00:00Z', soft_close_secs: 120 },
  userTier: { tier: 2 as 0|1|2, cap: null },
  isSeller: false,
  isAdmin: false,
}

async function flush() { await new Promise(r => setTimeout(r, 0)) }

describe('BidPanel', () => {
  beforeEach(() => {
    toastSpy.mockReset()
    rpcMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    realtimeState = { endsAt: baseProps.auction.ends_at, reserveMet: false, topBid: null, highBidder: null }
  })

  it('First bid equals starting bid calls RPC with offered=50', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const { getByPlaceholderText, getByRole } = render(<BidPanel {...baseProps} />)

    const input = getByPlaceholderText(/Enter/i) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '50')
    await userEvent.click(getByRole('button', { name: /place bid/i }))

    await flush()
    expect(rpcMock).toHaveBeenCalled()
    const [fnName, payload] = rpcMock.mock.calls[0]
    expect(fnName).toBe('app.place_bid')
    expect(payload.offered).toBe(50)
  })

  it('Under-minimum error surfaces server hint', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'Bid must be ≥ 110' } })
    const { getByPlaceholderText, getByRole } = render(<BidPanel {...baseProps} />)

    const input = getByPlaceholderText(/Enter/i) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '105')
    await userEvent.click(getByRole('button', { name: /place bid/i }))

    await flush()
    expect(toastSpy).toHaveBeenCalled()
    const arg = toastSpy.mock.calls[0][0]
    const text = (arg.title || '') + (arg.description || '')
    expect(text).toMatch(/110/)
  })

  it('Tier cap gating opens Verify modal and blocks RPC', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const { getByPlaceholderText, getByRole, findByTestId } = render(<BidPanel {...baseProps} userTier={{ tier: 0, cap: 200 }} />)

    const input = getByPlaceholderText(/Enter/i) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '250')
    await userEvent.click(getByRole('button', { name: /place bid/i }))

    await findByTestId('verify-modal')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('Seller cannot bid (button disabled)', () => {
    const { getByRole } = render(<BidPanel {...baseProps} isSeller />)
    const btn = getByRole('button', { name: /seller/i })
    expect(btn).toBeDisabled()
  })

  it('Soft-close toast fires when ends_at increases by >= soft_close_secs', async () => {
    const { rerender } = render(<BidPanel {...baseProps} />)
    // simulate extension
    realtimeState.endsAt = '2030-01-01T00:02:00Z'
    rerender(<BidPanel {...baseProps} />)

    await flush()
    expect(toastSpy).toHaveBeenCalled()
    const arg = toastSpy.mock.calls[0][0]
    const text = (arg.title || '') + (arg.description || '')
    expect(text).toMatch(/Extended \+2:00/i)
  })

  it('Reserve chip flips to MET on realtime update', async () => {
    const { rerender, findByText } = render(<BidPanel {...baseProps} />)
    realtimeState.reserveMet = true
    rerender(<BidPanel {...baseProps} />)
    await findByText(/RESERVE MET/i)
  })
})
