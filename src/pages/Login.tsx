import { Helmet } from "react-helmet-async";
import ZingNav from "@/components/ZingNav";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Ensure a profile row exists for the authenticated user
  const ensureProfile = async (sb: ReturnType<typeof getSupabase>, uid: string, email: string) => {
    try {
      const handle = email.split('@')[0];
      await sb!.schema('app').from('profiles').upsert({ id: uid, handle, display_name: handle }, { onConflict: 'id' });
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return toast({ description: "Supabase not configured" });
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard/buyer` },
        });
        if (error) throw error;
        if (data.user) {
          await ensureProfile(sb, data.user.id, email);
        }
        if (data.session) {
          navigate("/dashboard/buyer");
        } else {
          toast({ description: "Check your email to confirm your account." });
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          await ensureProfile(sb, data.user.id, email);
        }
        if (data.session) navigate("/dashboard/buyer");
      }
    } catch (err: any) {
      toast({ description: err?.message ?? "Authentication failed" });
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async () => {
    const sb = getSupabase();
    if (!sb) return toast({ description: "Supabase not configured" });
    if (!email) return toast({ description: "Enter your email first" });
    setLoading(true);
    try {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard/buyer` },
      });
      if (error) throw error;
      toast({ description: "Magic link sent. Check your email." });
    } catch (err: any) {
      toast({ description: err?.message ?? "Failed to send magic link" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Login | ZingLots</title>
        <meta name="description" content="Login or create an account to bid, pay invoices, and track orders on ZingLots." />
        <link rel="canonical" href="/login" />
      </Helmet>
      <ZingNav />
      <main className="container mx-auto px-4 py-10">
        <section className="mx-auto w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-bold">
            {isSignUp ? "Create your account" : "Sign in to ZingLots"}
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            {!isSignUp ? (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="password">Create a password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {isSignUp ? (loading ? "Creating…" : "Create account") : (loading ? "Signing in…" : "Sign in")}
              </Button>
              <Button type="button" variant="outline" onClick={sendMagicLink} disabled={loading}>
                Send magic link instead
              </Button>
            </div>
          </form>

          <div className="mt-4 text-sm text-muted-foreground">
            {isSignUp ? (
              <button className="underline" onClick={() => setIsSignUp(false)}>
                Already have an account? Sign in
              </button>
            ) : (
              <button className="underline" onClick={() => setIsSignUp(true)}>
                Don’t have an account? Create one
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;
