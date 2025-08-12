import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { handler } from "../index.ts";

// Simple mock facility injected through headers
function makeReq(url: string, token?: string) {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  return new Request(url, { method: 'GET', headers });
}

Deno.test("401 when no Authorization header", async () => {
  const req = makeReq("https://example.functions.supabase.co/functions/v1/bids-csv?lot_id=lot-1");
  const res = await handler(req);
  assertEquals(res.status, 401);
});

// Inject test mocks via globalThis
const sellerToken = "seller_token";
const adminToken = "admin_token";
const otherToken = "other_token";

(globalThis as any).__BIDS_CSV_TEST_MOCKS__ = {
  getUserByToken: (t: string) => {
    if (t === `Bearer ${sellerToken}`) return { id: 'user_seller' };
    if (t === `Bearer ${adminToken}`) return { id: 'user_admin' };
    if (t === `Bearer ${otherToken}`) return { id: 'user_other' };
    return null;
  },
  getLotById: async (id: string) => ({ id, show_id: 'show1' }),
  getShowById: async (id: string) => ({ id, seller_id: 'user_seller' }),
  getProfileRole: async (id: string) => id === 'user_admin' ? 'admin' : 'buyer',
  getCsvRows: async () => ([
    { created_at: new Date().toISOString(), alias: 'Bidder001', amount: 100, is_proxy: false },
    { created_at: new Date().toISOString(), alias: 'Bidder002', amount: 110, is_proxy: true },
  ]),
};

Deno.test("403 when non-seller non-admin", async () => {
  const req = makeReq("https://example.functions.supabase.co/functions/v1/bids-csv?lot_id=lot-1", otherToken);
  const res = await handler(req);
  assertEquals(res.status, 403);
});

Deno.test("200 for seller with CSV headers", async () => {
  const req = makeReq("https://example.functions.supabase.co/functions/v1/bids-csv?lot_id=lot-1", sellerToken);
  const res = await handler(req);
  assertEquals(res.status, 200);
  const text = await res.text();
  const firstLine = text.split('\n')[0];
  assertEquals(firstLine, 'timestamp,alias,amount,is_proxy');
});

Deno.test("200 for admin", async () => {
  const req = makeReq("https://example.functions.supabase.co/functions/v1/bids-csv?lot_id=lot-1", adminToken);
  const res = await handler(req);
  assertEquals(res.status, 200);
});
