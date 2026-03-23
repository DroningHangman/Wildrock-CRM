"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";

const links = [
  { href: "/contacts", label: "Contacts" },
  { href: "/relationships", label: "Relationships" },
  { href: "/reports", label: "Reports" },
  { href: "/bookings", label: "Bookings" },
  { href: "/members", label: "Members" },
  { href: "/documents", label: "Documents" },
  { href: "/emails", label: "Emails" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === "/login") return null;

  return (
    <nav className="w-full bg-background border-b border-border shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-display font-bold text-foreground hover:opacity-80 shrink-0">
          Wildrock CRM
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-bold transition-all py-1 border-b-2",
                pathname === link.href 
                  ? "text-primary border-primary" 
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden lg:inline text-xs font-medium text-muted-foreground">
              {user.email}
            </span>
          )}
          {user ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden lg:inline-flex border-input text-foreground hover:bg-muted"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
            >
              Logout
            </Button>
          ) : (
            <Link href="/login" className="hidden lg:inline text-sm font-bold text-foreground hover:text-primary">
              Login
            </Link>
          )}

          {/* Hamburger button */}
          <button
            className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-bold py-2 px-3 rounded-md transition-colors",
                  pathname === link.href
                    ? "text-primary bg-muted"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-border mt-2 pt-2 flex items-center justify-between px-3">
              {user && (
                <span className="text-xs font-medium text-muted-foreground truncate mr-3">
                  {user.email}
                </span>
              )}
              {user ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 border-input text-foreground hover:bg-muted"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  }}
                >
                  Logout
                </Button>
              ) : (
                <Link href="/login" className="text-sm font-bold text-foreground hover:text-primary">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
