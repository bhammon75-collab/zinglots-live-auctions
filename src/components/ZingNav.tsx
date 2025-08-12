import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";

const categories = ["TCG", "LEGO", "Action Figures", "Die-cast", "Plush"];

const ZingNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-tr from-primary to-accent shadow-[var(--shadow-glow)]" />
            <span className="text-lg font-extrabold tracking-tight">ZingLots</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/shows" className="text-sm text-muted-foreground hover:text-foreground">
            Shows
          </NavLink>
          <NavLink to="/discover" className="text-sm text-muted-foreground hover:text-foreground">
            Discover
          </NavLink>
          <div className="flex items-center gap-2">
            {categories.map((c) => (
              <NavLink key={c} to={`/category/${encodeURIComponent(c.toLowerCase().replace(/\s+/g, '-'))}`} className="text-sm text-muted-foreground hover:text-foreground">
                {c}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <Link to="/dashboard/seller">Start Selling</Link>
          </Button>
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
            <NavLink to="/discover" onClick={() => setOpen(false)} className="text-sm">Discover</NavLink>
            <div className="flex flex-wrap gap-3">
              {categories.map((c) => (
                <Button key={c} variant="pill" size="sm" asChild>
                  <Link to={`/category/${encodeURIComponent(c.toLowerCase().replace(/\s+/g, '-'))}`} onClick={() => setOpen(false)}>
                    {c}
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" asChild>
                <Link to="/login" onClick={() => setOpen(false)}>Sign In</Link>
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/dashboard/seller" onClick={() => setOpen(false)}>Start Selling</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default ZingNav;
