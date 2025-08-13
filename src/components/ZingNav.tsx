import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { FEATURED_CATEGORIES } from "@/data/categories";
import { supabase } from "@/integrations/supabase/client";


const ZingNav = () => {
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div
              className="h-10 w-10 rounded-md shadow-[var(--shadow-glow)] flex items-center justify-center font-extrabold text-2xl leading-none"
              style={{ backgroundColor: "hsl(var(--brand-blue))", color: "hsl(var(--brand-blue-foreground))" }}
            >
              Z
            </div>
            <span className="text-xl font-extrabold tracking-tight">ingLots</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/shows" className="text-sm text-muted-foreground hover:text-foreground">
            Shows
          </NavLink>
          <NavLink to="/live" className="text-sm text-muted-foreground hover:text-foreground">
            Live
          </NavLink>
          <NavLink to="/discover" className="text-sm text-muted-foreground hover:text-foreground">
            Discover
          </NavLink>
          <div className="flex items-center gap-2">
            {FEATURED_CATEGORIES.map((c) => (
              <NavLink key={c.slug} to={`/category/${c.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                {c.name}
              </NavLink>
            ))}
          </div>
        </nav>

<div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <>
              <Button variant="ghost" asChild>
                <Link to="/dashboard/buyer">Dashboard</Link>
              </Button>
              <Button variant="hero" size="sm" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                <Link to="/dashboard/seller">Sell now</Link>
              </Button>
              <Button variant="secondary" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/seller/apply">Apply</Link>
              </Button>
              <Button variant="hero" size="sm" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                <Link to="/dashboard/seller">Start Selling</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu className="text-foreground" />
        </button>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <div className="container mx-auto flex flex-col gap-3 px-4 py-4">
            <NavLink to="/shows" onClick={() => setOpen(false)} className="text-sm">Shows</NavLink>
            <NavLink to="/live" onClick={() => setOpen(false)} className="text-sm">Live</NavLink>
            <NavLink to="/discover" onClick={() => setOpen(false)} className="text-sm">Discover</NavLink>
            <div className="flex flex-wrap gap-3">
              {FEATURED_CATEGORIES.map((c) => (
                <Button key={c.slug} variant="pill" size="sm" asChild>
                  <Link to={`/category/${c.slug}`} onClick={() => setOpen(false)}>
                    {c.name}
                  </Link>
                </Button>
              ))}
            </div>
<div className="flex gap-2 pt-2">
              {isAuthed ? (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/dashboard/buyer" onClick={() => setOpen(false)}>Dashboard</Link>
                  </Button>
                  <Button variant="hero" size="sm" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                    <Link to="/dashboard/seller" onClick={() => setOpen(false)}>Sell now</Link>
                  </Button>
                  <Button variant="secondary" onClick={() => { handleSignOut(); setOpen(false); }}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/login" onClick={() => setOpen(false)}>Sign In</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/seller/apply" onClick={() => setOpen(false)}>Apply</Link>
                  </Button>
                  <Button variant="hero" size="sm" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                    <Link to="/dashboard/seller" onClick={() => setOpen(false)}>Start Selling</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default ZingNav;
