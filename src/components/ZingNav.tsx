import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Menu, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";


const ZingNav = () => {
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setIsAuthed(!!session);
    const meta = session?.user?.user_metadata || session?.user?.app_metadata || {};
    const roles: string[] | undefined = (meta as any)?.roles || (session?.user?.app_metadata?.roles as any);
    setIsAdmin(!!((meta as any)?.is_admin || roles?.includes?.("admin")));
    const name = (meta as any)?.full_name || (meta as any)?.first_name || (meta as any)?.name || session?.user?.email?.split("@")[0] || null;
    setDisplayName(name);
  });
  supabase.auth.getSession().then(({ data: { session } }) => {
    setIsAuthed(!!session);
    const meta = session?.user?.user_metadata || session?.user?.app_metadata || {};
    const roles: string[] | undefined = (meta as any)?.roles || (session?.user?.app_metadata?.roles as any);
    setIsAdmin(!!((meta as any)?.is_admin || roles?.includes?.("admin")));
    const name = (meta as any)?.full_name || (meta as any)?.first_name || (meta as any)?.name || session?.user?.email?.split("@")[0] || null;
    setDisplayName(name);
  });
  return () => subscription.unsubscribe();
}, []);


const handleSignOut = async () => {
  await supabase.auth.signOut();
};

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-0.5">
            <div
              className="h-10 w-10 rounded-md shadow-[var(--shadow-glow)] flex items-center justify-center font-extrabold text-2xl leading-none"
              style={{ backgroundColor: "hsl(var(--brand-blue))", color: "hsl(var(--brand-blue-foreground))" }}
            >
              Z
            </div>
            <span className="text-xl font-extrabold tracking-tight">ingLots!</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/discover" className="text-sm text-muted-foreground hover:text-foreground">
              Discover
            </NavLink>
            <NavLink to="/help" className="text-sm text-muted-foreground hover:text-foreground">
              Help & Contact
            </NavLink>
            {(() => {
              const showDrops = typeof window !== 'undefined' && (isAdmin || new URLSearchParams(window.location.search).get('dev') === '1');
              return showDrops ? (
                <NavLink to="/live" className="inline-flex items-center text-sm">
                  <Badge variant="secondary">Drops</Badge>
                </NavLink>
              ) : null;
            })()}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <>
              <Button variant="ghost" size="icon" asChild aria-label="Cart">
                <Link to="/cart"><ShoppingCart className="h-5 w-5" /></Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">
                    Hi, {displayName || 'there'}!
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                    <Link to="/dashboard/buyer">Buyer Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                    <Link to="/dashboard/seller">Seller Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="hero" size="sm" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                <Link to="/dashboard/seller">Sell now</Link>
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

              <Button variant="ghost" size="icon" asChild aria-label="Cart">
                <Link to="/cart"><ShoppingCart className="h-5 w-5" /></Link>
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
            <NavLink to="/help" onClick={() => setOpen(false)} className="text-sm">Help & Contact</NavLink>
            <NavLink to="/discover" onClick={() => setOpen(false)} className="text-sm">Discover</NavLink>
            {(() => {
              const showDrops = typeof window !== 'undefined' && (isAdmin || new URLSearchParams(window.location.search).get('dev') === '1');
              return showDrops ? (
                <NavLink to="/live" onClick={() => setOpen(false)} className="text-sm">
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs">Drops</span>
                </NavLink>
              ) : null;
            })()}
            <div className="flex gap-2 pt-2 flex-wrap">
              {isAuthed ? (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/dashboard/buyer" onClick={() => setOpen(false)}>Dashboard</Link>
                  </Button>
                  <Button variant="secondary" onClick={() => { handleSignOut(); setOpen(false); }}>
                    Sign out
                  </Button>
                  <Button variant="hero" size="sm" className="bg-none bg-brand-blue text-brand-blue-foreground" asChild>
                    <Link to="/dashboard/seller" onClick={() => setOpen(false)}>Sell now</Link>
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
