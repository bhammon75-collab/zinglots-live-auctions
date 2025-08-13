import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function GoLive() {
  const { toast } = useToast();
  const sb = getSupabase();
  const [roomName, setRoomName] = useState(`show-${Date.now()}`);
  const [destinations, setDestinations] = useState<Array<{ url: string; key: string }>>([
    { url: '', key: '' },
  ]);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try { roomRef.current?.disconnect?.(); } catch {}
    };
  }, []);

  const addDest = () => setDestinations((d) => [...d, { url: '', key: '' }]);
  const setDest = (i: number, field: 'url'|'key', val: string) => setDestinations((d) => d.map((x, idx) => idx===i? { ...x, [field]: val } : x));

  const connectPublisher = async () => {
    if (!sb) return;
    try {
      setConnecting(true);
      const { data, error } = await sb.functions.invoke('livekit-token', {
        body: { roomName, identity: 'seller', isPublisher: true },
      });
      if (error) throw error;
      const { url, token } = data as any;
      if (!url || !token) throw new Error('Missing LiveKit credentials');

      const { connect, createLocalVideoTrack, createLocalAudioTrack } = await import('livekit-client');
      const room = await connect(url, token);
      roomRef.current = room;
      const cam = await createLocalVideoTrack();
      const mic = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(cam);
      await room.localParticipant.publishTrack(mic);

      if (videoRef.current) {
        const el = await cam.attach();
        videoRef.current.srcObject = el.srcObject;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      toast({ description: 'Connected to LiveKit. You are publishing.' });
    } catch (e: any) {
      toast({ variant: 'destructive', description: e.message || 'Failed to connect' });
    } finally {
      setConnecting(false);
    }
  };

  const startSimulcast = async () => {
    if (!sb) return;
    try {
      const { data, error } = await sb.functions.invoke('livekit-start-egress', {
        body: { roomName, destinations: destinations.filter(d => d.url && d.key) },
      });
      if (error) throw error;
      setEgressId((data as any)?.egress_id || (data as any)?.room_composite_id || null);
      toast({ description: 'Simulcast started' });
    } catch (e: any) {
      toast({ variant: 'destructive', description: e.message || 'Failed to start simulcast' });
    }
  };

  const stopSimulcast = async () => {
    if (!sb || !egressId) return;
    try {
      const { error } = await sb.functions.invoke('livekit-stop-egress', { body: { egress_id: egressId } });
      if (error) throw error;
      toast({ description: 'Simulcast stop requested' });
    } catch (e: any) {
      toast({ variant: 'destructive', description: e.message || 'Failed to stop simulcast' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Go Live | ZingLots</title>
        <meta name="description" content="Start your live show, publish to LiveKit, and simulcast to Facebook/Instagram." />
        <link rel="canonical" href="/seller/live" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-3">
        <section className="md:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold">Go Live</h1>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div>
              <label className="text-sm">Room name</label>
              <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">RTMP Destinations</div>
              {destinations.map((d, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input placeholder="rtmps://…" value={d.url} onChange={(e) => setDest(i,'url', e.target.value)} />
                  <Input placeholder="stream key" value={d.key} onChange={(e) => setDest(i,'key', e.target.value)} />
                </div>
              ))}
              <Button variant="outline" onClick={addDest}>Add destination</Button>
            </div>
            <div className="flex gap-3">
              <Button onClick={connectPublisher} disabled={connecting} aria-disabled={connecting}>{connecting ? 'Connecting…' : 'Connect & Publish'}</Button>
              <Button variant="secondary" onClick={startSimulcast}>Start Simulcast</Button>
              <Button variant="outline" onClick={stopSimulcast} disabled={!egressId} aria-disabled={!egressId}>Stop Simulcast</Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-2">
            <video ref={videoRef} className="aspect-video w-full rounded-md bg-muted" playsInline muted />
          </div>
        </section>
        <aside>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Tip: Facebook RTMPS URL is rtmps://live-api-s.facebook.com:443/rtmp/</div>
            <div className="text-sm text-muted-foreground">Instagram Producer URL is rtmps://live-upload.instagram.com:443/rtmp/</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
