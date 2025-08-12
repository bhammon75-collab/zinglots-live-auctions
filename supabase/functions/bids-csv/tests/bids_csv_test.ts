import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createHandler } from "../index.ts";

const baseDeps = {
  getUser: async (_req: Request) => ({ id: "u1" }),
  getLot: async (_lotId: string) => ({ seller_id: "seller1", auction_id: "a1" }),
  getProfile: async (_userId: string) => ({ role: "user" }),
  getRows: async (_lotId: string) => ([
    { created_at: "2025-08-12T00:00:00Z", alias: "Bidder123", amount: 100, is_proxy: false },
    { created_at: "2025-08-12T00:01:00Z", alias: "Bidder456", amount: 110, is_proxy: true },
  ]),
};

Deno.test("401 when no auth user", async () => {
  const handler = createHandler({ ...baseDeps, getUser: async () => null });
  const res = await handler(new Request("http://localhost/functions/v1/bids-csv?lot_id=L1"));
  assertEquals(res.status, 401);
});

Deno.test("403 when not seller and not admin", async () => {
  const handler = createHandler({
    ...baseDeps,
    getLot: async () => ({ seller_id: "sellerX", auction_id: "a1" }),
    getProfile: async () => ({ role: "user" }),
  });
  const res = await handler(new Request("http://localhost/functions/v1/bids-csv?lot_id=L1"));
  assertEquals(res.status, 403);
});

Deno.test("200 for seller; returns text/csv and header row", async () => {
  const handler = createHandler({
    ...baseDeps,
    getLot: async () => ({ seller_id: "u1", auction_id: "a1" }),
  });
  const res = await handler(new Request("http://localhost/functions/v1/bids-csv?lot_id=L1"));
  assertEquals(res.status, 200);
  const ct = res.headers.get("content-type") || "";
  assertEquals(ct.startsWith("text/csv"), true);
  const text = await res.text();
  const firstLine = text.split("\n")[0];
  assertEquals(firstLine, 'timestamp,alias,amount,is_proxy');
});

Deno.test("200 for admin", async () => {
  const handler = createHandler({
    ...baseDeps,
    getProfile: async () => ({ role: "admin" }),
    getLot: async () => ({ seller_id: "someone_else", auction_id: "a1" }),
  });
  const res = await handler(new Request("http://localhost/functions/v1/bids-csv?lot_id=L1"));
  assertEquals(res.status, 200);
});
