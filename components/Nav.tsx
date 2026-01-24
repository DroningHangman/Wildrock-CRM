"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";

const links = [
  { href: "/", label: "Home" },
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

  // Hide nav on login page
  if (pathname === "/login") return null;

  return (
    <nav className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-lg font-semibold text-foreground hover:opacity-80"
        >
          Wildrock CRM
        </Link>
        <div className="flex items-center gap-2">
          {links.slice(1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            {user.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
}
