"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_VARS = [
  "name", "first_name", "email", "phone", "organization",
  "membership_type", "membership_status", "membership_expiry_date", "membership_days_until_expiry",
  "last_booking_program", "last_booking_date", "today", "org_name",
];

interface ContactResult {
  id: string;
  name: string | null;
  email: string | null;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactResult[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || selectedContact) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      }
    }, 300);
  }, [searchQuery, selectedContact]);

  const extractVariables = (text: string): string[] => {
    const matches = Array.from(text.matchAll(/\{\{(\w+)\}\}/g));
    return Array.from(new Set(matches.map((m) => m[1])));
  };

  const handleSave = async () => {
    if (!name || !subject || !bodyHtml) {
      setError("Name, subject, and body are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const variables = extractVariables(subject + " " + bodyHtml);
    const res = await fetch("/api/email/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, body_html: bodyHtml, variables }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save template.");
      setSaving(false);
      return;
    }
    router.push("/emails/templates");
  };

  const insertVar = (v: string, field: "subject" | "body") => {
    const token = `{{${v}}}`;
    if (field === "subject") setSubject((s) => s + token);
    else setBodyHtml((s) => s + token);
  };

  const handlePreview = async (withContact: boolean) => {
    if (!subject || !bodyHtml) {
      setPreviewError("Subject and body are required to preview.");
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    const res = await fetch("/api/email/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        body_html: bodyHtml,
        contact_id: withContact && selectedContact ? selectedContact.id : undefined,
      }),
    });
    setPreviewing(false);
    if (!res.ok) {
      const data = await res.json();
      setPreviewError(data.error ?? "Preview failed.");
      return;
    }
    const data = await res.json();
    setPreviewHtml(data.html);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/emails/templates">← Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">New Template</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input placeholder="e.g. Welcome Message" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder={`e.g. Hello {{first_name}}!`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              placeholder={`Hi {{first_name}},\n\nThank you for visiting Wildrock!\n\nBest,\nThe Wildrock Team`}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Write in plain text — blank lines become paragraph breaks. HTML is also accepted.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/emails/templates">Cancel</Link>
            </Button>
          </div>

          {/* Preview section */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold">Preview</p>

            <div className="relative" ref={searchRef}>
              <Input
                placeholder="Search contact by name or email…"
                value={selectedContact ? (selectedContact.name ?? selectedContact.email ?? "") : searchQuery}
                onChange={(e) => {
                  setSelectedContact(null);
                  setSearchQuery(e.target.value);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
              />
              {selectedContact && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs px-1"
                  onClick={() => { setSelectedContact(null); setSearchQuery(""); }}
                >
                  ✕
                </button>
              )}
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setSelectedContact(c);
                        setSearchQuery("");
                        setShowDropdown(false);
                      }}
                    >
                      <span className="font-medium">{c.name ?? "—"}</span>
                      <span className="text-muted-foreground ml-2">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedContact && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedContact.name ?? selectedContact.email}</span>
              </p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handlePreview(true)}
                disabled={previewing || !selectedContact}
              >
                {previewing ? "Loading…" : "Preview"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePreview(false)}
                disabled={previewing}
              >
                Preview without contact
              </Button>
            </div>

            {previewError && <p className="text-sm text-destructive">{previewError}</p>}

            {previewHtml && (
              <iframe
                srcDoc={previewHtml}
                className="w-full border rounded-md"
                style={{ height: "600px" }}
                title="Email preview"
              />
            )}
          </div>
        </div>

        {/* Variable helper sidebar */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Available Variables</p>
          <p className="text-xs text-muted-foreground">Click to insert into subject or body.</p>
          <div className="space-y-2">
            {AVAILABLE_VARS.map((v) => (
              <div key={v} className="flex gap-1">
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs flex-1 justify-center"
                  onClick={() => insertVar(v, "subject")}
                  title="Insert into subject"
                >
                  {"{{"}{v}{"}}"}
                </Badge>
                <Button variant="ghost" size="sm" className="text-xs px-2 h-6" onClick={() => insertVar(v, "body")} title="Insert into body">
                  body
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
