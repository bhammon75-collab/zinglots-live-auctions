import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { getSupabase } from "@/lib/supabaseClient";

export default function CSVImport({ showId, sellerId }: { showId: string; sellerId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const sb = getSupabase();

  async function upload() {
    if (!file || !sb) return;
    setBusy(true);
    try {
      const session = (await sb.auth.getSession()).data.session;
      const resp = await fetch(`/functions/v1/lots-import-csv?show_id=${showId}&seller_id=${sellerId}` , {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          Authorization: session ? `Bearer ${session.access_token}` : "",
        },
        body: await file.text(),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Import failed");
      toast({ title: 'Import complete', description: 'Your lots were added.' });
      setFile(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Import failed', description: e?.message || String(e) });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="csv">CSV file</Label>
      <Input id="csv" type="file" accept=".csv,text/csv" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
      <Button onClick={upload} disabled={!file || busy} aria-disabled={!file || busy}>{busy ? "Importing..." : "Import lots"}</Button>
    </div>
  );
}
