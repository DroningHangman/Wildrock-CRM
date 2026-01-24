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

  if (pathname === "/login") return null;

  return (
    <nav className="w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link href="/" className="text-xl font-bold text-slate-900 hover:opacity-80">
            Wildrock CRM
          </Link>
          <div className="flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-bold transition-all py-1 border-b-2",
                  pathname === link.href 
                    ? "text-blue-600 border-blue-600" 
                    : "text-slate-500 border-transparent hover:text-slate-900"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {user && (
            <span className="hidden md:inline text-xs font-medium text-slate-500">
              {user.email}
            </span>
          )}
          {user ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
            >
              Logout
            </Button>
          ) : (
            <Link href="/login" className="text-sm font-bold text-slate-700 hover:text-slate-900">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
