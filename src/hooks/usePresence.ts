import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export type PresenceUser = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  online_at: string;
};

export function usePresence(room: string) {
  const [participants, setParticipants] = useState<Record<string, PresenceUser[]>>({});
  const sbRef = useRef(getSupabase());
  const channelRef = useRef<ReturnType<NonNullable<typeof sbRef.current>["channel"]> | null>(null);

  useEffect(() => {
    const sb = sbRef.current;
    if (!sb || !room) return;

    let mounted = true;

    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const userId = auth?.user?.id ?? sessionStorage.getItem("anon_id") ?? crypto.randomUUID();
      sessionStorage.setItem("anon_id", userId);

      const channel = sb.channel(`presence:${room}`, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          if (!mounted) return;
          const state = channel.presenceState() as Record<string, PresenceUser[]>;
          setParticipants(state);
        })
        .on("presence", { event: "join" }, () => {
          if (!mounted) return;
          const state = channel.presenceState() as Record<string, PresenceUser[]>;
          setParticipants(state);
        })
        .on("presence", { event: "leave" }, () => {
          if (!mounted) return;
          const state = channel.presenceState() as Record<string, PresenceUser[]>;
          setParticipants(state);
        })
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          await channel.track({
            id: userId,
            online_at: new Date().toISOString(),
          } satisfies PresenceUser);
        });
    })();

    return () => {
      mounted = false;
      if (channelRef.current) sbRef.current?.removeChannel(channelRef.current);
    };
  }, [room]);

  const flat = useMemo(() => Object.values(participants).flat(), [participants]);

  return {
    participants: flat,
    count: flat.length,
  } as const;
}
