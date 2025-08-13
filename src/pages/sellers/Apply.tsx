import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { getSupabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const categories = ["cards","vintage-toys","sneakers","jewelry","coins","comics","antiques"];

export default function SellerApply() {
  const sb = getSupabase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    category_primary: "cards",
    avg_sell_price_cents: "",
    lots_per_show_est: "",
    shop_links: "",
    timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
    preferred_slots: "",
    notes: ""
  });

  function set<K extends keyof typeof form>(k: K, v: string) { setForm({ ...form, [k]: v }); }

  async function submit() {
    if (!sb) return;
    setLoading(true);
    try {
      const shop_links = form.shop_links
        ? form.shop_links.split(/\s*,\s*|\s*\n\s*/).filter(Boolean)
        : [];
      const preferred_slots = form.preferred_slots
        ? form.preferred_slots.split(/\s*,\s*/).filter(Boolean)
        : [];
      const { data: session } = await sb.auth.getSession();
      const user_id = session?.session?.user?.id ?? null;

      const { error } = await sb
        .schema('app')
        .from('seller_applications')
        .insert({
          user_id,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          category_primary: form.category_primary,
          avg_sell_price_cents: form.avg_sell_price_cents ? Number(form.avg_sell_price_cents) : null,
          lots_per_show_est: form.lots_per_show_est ? Number(form.lots_per_show_est) : null,
          shop_links,
          timezone: form.timezone,
          preferred_slots,
          notes: form.notes || null,
        });
      if (error) throw error;
      toast({ title: 'Application submitted', description: 'We’ll review and email you shortly.' });
      setForm({ ...form, full_name:"", email:"", phone:"", avg_sell_price_cents:"", lots_per_show_est:"", shop_links:"", preferred_slots:"", notes:"" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submission failed', description: e?.message || String(e) });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Apply as a Seller | ZingLots</title>
        <meta name="description" content="Apply to sell on ZingLots: share your shop links, category, and typical show details." />
        <link rel="canonical" href="/seller/apply" />
      </Helmet>
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Apply as a Seller</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tell us about your inventory and selling experience.</p>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={form.full_name} onChange={(e)=>set("full_name", e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e)=>set("email", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={form.phone} onChange={(e)=>set("phone", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary category</Label>
              <Select value={form.category_primary} onValueChange={(v)=>set("category_primary", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avg sell price ($)</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g., 35"
                value={form.avg_sell_price_cents}
                onChange={(e)=> set("avg_sell_price_cents", String(Math.round(Number(e.target.value||"0")*100)))}
              />
              <p className="text-xs text-muted-foreground">We store cents (e.g., $35 → 3500)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lots per show (est.)</Label>
              <Input type="number" value={form.lots_per_show_est} onChange={(e)=>set("lots_per_show_est", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e)=>set("timezone", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Shop links (comma or newline separated)</Label>
            <Textarea value={form.shop_links} onChange={(e)=>set("shop_links", e.target.value)} placeholder="https://www.ebay.com/usr/..., https://instagram.com/..." />
          </div>

          <div className="space-y-2">
            <Label>Preferred live slots (comma-separated)</Label>
            <Input value={form.preferred_slots} onChange={(e)=>set("preferred_slots", e.target.value)} placeholder="Tue 7–9pm PT, Thu 6–8pm PT" />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e)=>set("notes", e.target.value)} />
          </div>

          <Button onClick={submit} disabled={loading} aria-disabled={loading}>{loading ? "Submitting..." : "Submit application"}</Button>
        </div>
      </main>
    </div>
  );
}
