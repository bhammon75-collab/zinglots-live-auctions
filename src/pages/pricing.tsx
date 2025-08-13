import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Helmet } from 'react-helmet-async'
import ZingNav from '@/components/ZingNav'

function calcZingLots(price: number, buyerPaysShipping: boolean, shipping: number) {
  const rate = 0.10   // Launch/Beta example: 10% + $0.25 — adjust to your live fee
  const perOrder = 0.25
  const base = price + (buyerPaysShipping ? shipping : 0)
  return Math.max(0, base * rate + perOrder)
}
function calcEbayTypical(price: number, buyerPaysShipping: boolean, shipping: number) {
  // Simplified "most categories": 13.6% + $0.40 if >$10 else $0.30
  const rate = 0.136
  const perOrder = price > 10 ? 0.40 : 0.30
  const base = price + (buyerPaysShipping ? shipping : 0)
  return Math.max(0, base * rate + perOrder)
}

export default function PricingPage() {
  const [price, setPrice] = React.useState(100)
  const [shipping, setShipping] = React.useState(0)
  const [buyerPaysShipping, setBps] = React.useState(true)

  const zl = calcZingLots(price, buyerPaysShipping, shipping)
  const eb = calcEbayTypical(price, buyerPaysShipping, shipping)
  const save = Math.max(0, eb - zl)

  return (
    <>
      <Helmet>
        <title>Pricing - ZingLots</title>
        <meta name="description" content="Simple, transparent marketplace fees designed for auctions. Compare our rates with eBay and see how much you can save." />
      </Helmet>
      <ZingNav />
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-semibold mb-2">Pricing</h1>
        <p className="text-muted-foreground mb-6">
          Simple, transparent marketplace fees designed for auctions.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 items-end max-w-3xl">
          <div>
            <Label htmlFor="p">Item price ($)</Label>
            <Input id="p" type="number" step="0.01" value={price}
                   onChange={e=>setPrice(Number(e.target.value||0))}/>
          </div>
          <div>
            <Label htmlFor="s">Shipping charged to buyer ($)</Label>
            <Input id="s" type="number" step="0.01" value={shipping}
                   onChange={e=>setShipping(Number(e.target.value||0))}/>
            <div className="text-xs mt-1">
              <label>
                <input type="checkbox" checked={buyerPaysShipping}
                       onChange={e=>setBps(e.target.checked)} /> Include in fee calculation
              </label>
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm">ZingLots fee</div>
            <div className="text-2xl font-semibold">${zl.toFixed(2)}</div>
            <div className="text-sm mt-3">eBay typical</div>
            <div className="text-2xl font-semibold">${eb.toFixed(2)}</div>
            <div className="text-sm mt-3 text-green-600">
              You save ≈ <strong>${save.toFixed(2)}</strong> per order
            </div>
          </div>
        </div>
        <div className="mt-6 text-sm text-muted-foreground max-w-3xl">
          "eBay typical" is an estimate for most categories. Actual eBay fees vary by category and options.
        </div>
      </div>
    </>
  )
}