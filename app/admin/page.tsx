"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function parseArr(val: string): string[] {
  if (!val?.trim()) return [];
  return val.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
}

export default function AdminPage() {
  const [contacts, setContacts] = useState<{ tags: string[] | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchContacts() {
    setLoading(true);
    const { data, error } = await supabase.from("contacts").select("tags");
    setLoading(false);
    if (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
      return;
    }
    setContacts((data as { tags: string[] | null }[]) ?? []);
  }

  useEffect(() => {
    fetchContacts();
  }, []);

  const allTags = Array.from(
    new Set(contacts.flatMap((c) => c.tags ?? []).filter(Boolean))
  ).sort();

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h] = values[j] ?? "";
      });
      rows.push(row);
    }
    return rows;
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    setImporting(true);
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      setImportError("CSV has no data rows.");
      setImporting(false);
      e.target.value = "";
      return;
    }
    const toInsert = rows.map((r) => {
      const contactTypes = parseArr(r.contact_types ?? r.type ?? "");
      const tags = parseArr(r.tags ?? "");
      return {
        name: r.name?.trim() || null,
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        contact_types: contactTypes.length ? contactTypes : null,
        organization: r.organization?.trim() || null,
        tags: tags.length ? tags : null,
        notes: r.notes?.trim() || null,
      };
    }).filter((c) => c.name);

    if (!toInsert.length) {
      setImportError("No valid contacts (name required).");
      setImporting(false);
      e.target.value = "";
      return;
    }

    const { error } = await supabase.from("contacts").insert(toInsert);
    setImporting(false);
    e.target.value = "";
    if (error) {
      setImportError(error.message);
      return;
    }
    setImportSuccess(toInsert.length);
    fetchContacts();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Tools</h1>
        <p className="text-muted-foreground">
          Batch import contacts via CSV. Tags shown are those used across contacts.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CSV import</CardTitle>
            <CardDescription>
              Upload a CSV with columns: name, email, phone, contact_types, organization, tags, notes.
              Name required. contact_types and tags: comma-separated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCSVImport}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing…" : "Choose CSV"}
            </Button>
            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}
            {importSuccess !== null && (
              <p className="text-sm text-green-600">
                Imported {importSuccess} contact(s).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags in use</CardTitle>
            <CardDescription>
              Unique tags across all contacts (read-only).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
                {allTags.length === 0 && (
                  <p className="text-muted-foreground text-sm">No tags yet.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
