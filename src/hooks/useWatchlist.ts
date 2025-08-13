import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function useWatchlist(lotId: string) {
  const { toast } = useToast();
  const [watched, setWatched] = useState(false);
  const [loading, setLoading] = useState(true);

  const useLocal = useMemo(() => !isUuid(lotId), [lotId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (useLocal) {
          const raw = localStorage.getItem("watchlist");
          const list: string[] = raw ? JSON.parse(raw) : [];
          if (!cancelled) setWatched(list.includes(lotId));
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setWatched(false);
          return;
        }

        const { data, error } = await supabase
          .from("watchlists")
          .select("lot_id")
          .eq("lot_id", lotId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setWatched(!!data);
      } catch (err) {
        // Silent fail for init
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [lotId, useLocal]);

  const toggle = useCallback(async () => {
    try {
      setLoading(true);
      if (useLocal) {
        const raw = localStorage.getItem("watchlist");
        const list: string[] = raw ? JSON.parse(raw) : [];
        const exists = list.includes(lotId);
        const next = exists ? list.filter((id) => id !== lotId) : [...list, lotId];
        localStorage.setItem("watchlist", JSON.stringify(next));
        setWatched(!exists);
        toast({ description: exists ? "Removed from Watchlist" : "Added to Watchlist" });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ description: "Sign in to save to Watchlist" });
        return;
      }

      if (watched) {
        const { error } = await supabase
          .from("watchlists")
          .delete()
          .eq("lot_id", lotId);
        if (error) throw error;
        setWatched(false);
        toast({ description: "Removed from Watchlist" });
      } else {
        const userId = session.user.id;
        const { error } = await supabase
          .from("watchlists")
          .insert({ user_id: userId, lot_id: lotId });
        if (error) throw error;
        setWatched(true);
        toast({ description: "Added to Watchlist" });
      }
    } catch (err: any) {
      toast({ description: err?.message || "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }, [lotId, useLocal, watched, toast]);

  return { watched, loading, toggle };
}
