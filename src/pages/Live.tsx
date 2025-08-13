import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabaseClient";
import dayjs from "dayjs";

type Show = {
  id: string;
  title: string | null;
  category: string | null;
  cover_url: string | null;
  start_at: string | null;
  end_at: string | null;
};

function Countdown({ start }: { start: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(()=>setNow(Date.now()), 1000); return ()=>clearInterval(t); }, []);
  const diff = Math.max(0, dayjs(start).valueOf() - now);
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400)/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return <span className="tabular-nums">{d}d {h}h {m}m {sec}s</span>;
}

export default function Live() {
  const sb = getSupabase();
  const [shows, setShows] = useState<Show[]>([]);
  const [notify, setNotify] = useState<{open:boolean, show?:Show}>({open:false});

  useEffect(() => {
    (async () => {
      if (!sb) return;
      const from = dayjs().toISOString();
      const to = dayjs().add(14, "day").toISOString();
      const { data, error } = await sb
        .schema('app')
        .from('shows')
        .select("id,title,category,cover_url,start_at,end_at")
        .gte("start_at", from).lte("start_at", to)
        .order("start_at", { ascending: true });
      if (!error && data) setShows(data as any);
    })();
  }, [sb]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Upcoming Live Shows | ZingLots</title>
        <meta name="description" content="Browse upcoming live auction shows and set reminders so you never miss a drop." />
        <link rel="canonical" href="/live" />
      </Helmet>
      <main className="container mx-auto px-4 py-10 space-y-6">
        <h1 className="text-3xl font-bold">Upcoming Live Shows</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shows.map(s => (
            <article key={s.id} className="rounded-2xl overflow-hidden border bg-card">
              {s.cover_url ? (
                <img src={s.cover_url} alt={s.title || "Show cover"} className="w-full h-40 object-cover" loading="lazy" />
              ) : (
                <div className="h-40 bg-muted" />
              )}
              <div className="p-4 space-y-2">
                <div className="text-sm uppercase tracking-wide text-muted-foreground">{s.category || "Live Auction"}</div>
                <h2 className="text-lg font-semibold">{s.title || "Untitled Show"}</h2>
                {s.start_at && <div className="text-sm">Starts in: <Countdown start={s.start_at} /></div>}
                <div className="flex gap-2 pt-2">
                  <Button onClick={()=>window.location.href=`/shows/${s.id}`}>View show</Button>
                  <Button variant="secondary" onClick={()=>setNotify({open:true, show:s})}>Notify me</Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {notify.open && notify.show && (
          <NotifyModal show={notify.show} onClose={()=>setNotify({open:false})} />
        )}
      </main>
    </div>
  );
}

function NotifyModal({ show, onClose }: { show: Show; onClose: ()=>void }) {
  const sb = getSupabase();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!sb) return;
    setBusy(true);
    try {
      const { error } = await sb
        .schema('app')
        .from('show_notifications')
        .insert({ show_id: show.id, email: email || null, phone: phone || null });
      if (error) throw error;
      onClose();
    } catch (e) {
      // no-op minimal handling
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-xl font-semibold">Get a reminder</h2>
        <p className="text-sm text-muted-foreground">We’ll remind you before “{show.title || "Live Show"}”.</p>
        <div className="space-y-2">
          <Label>Email (optional)</Label>
          <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label>Phone (optional)</Label>
          <Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+1..." />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || (!email && !phone)} aria-disabled={busy || (!email && !phone)}>{busy ? "Saving..." : "Notify me"}</Button>
        </div>
      </div>
    </div>
  );
}
