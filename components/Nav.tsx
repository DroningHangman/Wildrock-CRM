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
  { href: "/bookings", label: "Bookings" },
  { href: "/members", label: "Members" },
  { href: "/documents", label: "Documents" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hide on login page
  if (pathname === "/login") return null;

  return (
    <nav className="w-full bg-slate-900 text-white border-b border-slate-800 shadow-lg">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="text-xl font-bold tracking-tight hover:text-slate-300">
            Wildrock CRM
          </Link>
          <div className="flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-slate-300",
                  pathname === link.href ? "text-white underline underline-offset-8 decoration-2" : "text-slate-400"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {user && (
            <span className="hidden md:inline text-xs text-slate-400">
              {user.email}
            </span>
          )}
          {user ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-slate-900 border-white bg-white hover:bg-slate-200"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
            >
              Logout
            </Button>
          ) : (
            <Link href="/login" className="text-sm font-medium hover:text-slate-300">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
