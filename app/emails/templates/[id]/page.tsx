"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/email/templates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? "");
        setSubject(data.subject ?? "");
        setBodyHtml(data.body_html ?? "");
        setLoading(false);
      });
  }, [id]);

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
    const res = await fetch(`/api/email/templates/${id}`, {
      method: "PUT",
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

  const handleDelete = async () => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await fetch(`/api/email/templates/${id}`, { method: "DELETE" });
    router.push("/emails/templates");
  };

  const insertVar = (v: string, field: "subject" | "body") => {
    const token = `{{${v}}}`;
    if (field === "subject") setSubject((s) => s + token);
    else setBodyHtml((s) => s + token);
  };

  if (loading) return <div className="container mx-auto px-4 py-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/emails/templates">← Back</Link>
          </Button>
          <h1 className="text-2xl font-bold">Edit Template</h1>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Delete Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Write in plain text — blank lines become paragraph breaks. HTML is also accepted.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/emails/templates">Cancel</Link>
            </Button>
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
