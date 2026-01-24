"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Completely hide nav only on login page
  if (pathname === "/login") return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white dark:bg-slate-950 px-4 md:px-6 py-3">
      <div className="flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto gap-3 md:gap-8">
        <div className="flex items-center justify-between w-full md:w-auto gap-8">
          <Link
            href="/"
            className="text-lg font-bold text-foreground hover:opacity-80 whitespace-nowrap"
          >
            Wildrock CRM
          </Link>
          
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                  pathname === href
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto md:ml-0">
          {user ? (
            <>
              <span className="hidden text-xs text-muted-foreground lg:inline-block">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs h-8">
                Logout
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" size="sm" className="text-xs h-8">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
