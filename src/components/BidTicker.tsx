import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type TickerBid = {
  id: string;
  amount: number; // dollars
  created_at: string;
  user_id?: string | null;
};

function maskUser(u?: string | null) {
  if (!u) return "Bidder" + Math.floor(Math.random() * 900 + 100);
  return "Bidder" + u.slice(0, 3);
}

export default function BidTicker({ lotId, onNewBid }: { lotId: string; onNewBid?: (bid: TickerBid) => void }) {
  const [bids, setBids] = useState<TickerBid[]>([]);
  const sbRef = useRef(getSupabase());

  useEffect(() => {
    const sb = sbRef.current;
    if (!sb || !lotId) return;

    let mounted = true;

    (async () => {
      const { data } = await sb
        .schema("app")
        .from("bids")
        .select("id, amount, created_at, user_id")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (mounted && data) {
        setBids(
          (data as any[]).map((d) => ({ id: d.id, amount: Number(d.amount), created_at: d.created_at, user_id: d.user_id }))
        );
      }
    })();

    const channel = sb
      .channel(`bids:${lotId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "app", table: "bids", filter: `lot_id=eq.${lotId}` },
        (payload: any) => {
          const bid: TickerBid = {
            id: payload.new.id,
            amount: Number(payload.new.amount),
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
          };
          setBids((prev) => [bid, ...prev].slice(0, 10));
          onNewBid?.(bid);
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
      mounted = false;
    };
  }, [lotId, onNewBid]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-3 text-sm font-medium">Live Bid Ticker</div>
      <ul className="max-h-80 divide-y">
        {bids.map((b) => (
          <li key={b.id} className={cn("flex items-center gap-3 p-3 animate-fade-in")}>
            <Avatar className="h-7 w-7">
              <AvatarImage src={undefined} alt={`${maskUser(b.user_id)} avatar`} />
              <AvatarFallback>{maskUser(b.user_id).slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 leading-tight">
              <div className="text-sm">
                <span className="font-semibold">${""}{b.amount.toFixed(2)}</span>
                <span className="ml-2 text-muted-foreground">{maskUser(b.user_id)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
          </li>
        ))}
        {bids.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No bids yet — be the first!</li>
        )}
      </ul>
    </div>
  );
}
