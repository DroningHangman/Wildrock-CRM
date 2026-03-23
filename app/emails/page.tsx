"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EmailsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Emails</h1>
        <p className="text-muted-foreground mt-1">Manage email templates and send personalized messages.</p>
      </div>

      <div className="flex gap-3 border-b mb-6">
        <Link
          href="/emails/templates"
          className="px-4 py-2 text-sm font-semibold border-b-2 border-primary text-primary -mb-px"
        >
          Templates
        </Link>
        <span className="px-4 py-2 text-sm font-semibold text-muted-foreground cursor-not-allowed">
          Campaigns <span className="ml-1 text-xs bg-muted rounded px-1.5 py-0.5">Coming soon</span>
        </span>
      </div>

      <div className="text-center py-16 text-muted-foreground">
        <p className="mb-4">Create and manage email templates, then send them from a contact&apos;s profile.</p>
        <Button asChild>
          <Link href="/emails/templates">View Templates</Link>
        </Button>
      </div>
    </div>
  );
}
