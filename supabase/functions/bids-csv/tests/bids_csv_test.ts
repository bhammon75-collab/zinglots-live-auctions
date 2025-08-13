import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { createHandler } from "../index.ts"

const base = {
  getUser: async () => ({ id: "u1" }),
  getLot: async () => ({ seller_id: "seller1", auction_id: "a1" }),
  getProfile: async () => ({ role: "user" }),
  getRows: async () => ([{ created_at: "2025-08-12T00:00:00Z", alias: "Bidder123", amount: 100, is_proxy: false }])
}

Deno.test("401 when no auth user", async () => {
  const h = createHandler({ ...base, getUser: async () => null })
  const r = await h(new Request("http://x?lot_id=L1"))
  assertEquals(r.status, 401)
})

Deno.test("403 when not seller and not admin", async () => {
  const h = createHandler({ ...base, getLot: async () => ({ seller_id: "not-u1", auction_id: "a1" }) })
  const r = await h(new Request("http://x?lot_id=L1"))
  assertEquals(r.status, 403)
})

Deno.test("200 for seller; returns text/csv", async () => {
  const h = createHandler({ ...base, getLot: async () => ({ seller_id: "u1", auction_id: "a1" }) })
  const r = await h(new Request("http://x?lot_id=L1"))
  assertEquals(r.status, 200)
  assertEquals((r.headers.get("content-type")||"").startsWith("text/csv"), true)
  const text = await r.text()
  assertEquals(text.split("\n")[0], "timestamp,alias,amount,is_proxy")
})

Deno.test("200 for admin; returns text/csv", async () => {
  const h = createHandler({ ...base, getProfile: async () => ({ role: "admin" }), getLot: async () => ({ seller_id: "someone", auction_id: "a1" }) })
  const r = await h(new Request("http://x?lot_id=L1"))
  assertEquals(r.status, 200)
})
