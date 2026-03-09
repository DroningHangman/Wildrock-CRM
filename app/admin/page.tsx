"use client";

import { useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── helpers ────────────────────────────────────────────────────────────────

function parseArr(val: string): string[] {
  if (!val?.trim()) return [];
  return val
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    if (file.name.toLowerCase().endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve(r.data as Record<string, string>[]),
        error: reject,
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(
            XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<
              string,
              string
            >[]
          );
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    }
  });
}

function parseDate(val: string): string | null {
  if (!val?.trim()) return null;
  // Try common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.
  const iso = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mdy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  // Last resort: try Date parse
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

// ─── CRM field definitions ───────────────────────────────────────────────────

type ImportType = "contacts" | "bookings" | "members";

interface CrmField {
  key: string;
  label: string;
  required: boolean;
}

const CRM_FIELDS: Record<ImportType, CrmField[]> = {
  contacts: [
    { key: "name", label: "Name", required: true },
    { key: "email", label: "Email", required: true },
    { key: "phone", label: "Phone", required: false },
    { key: "contact_types", label: "Contact Types", required: false },
    { key: "organization", label: "Organization", required: false },
    { key: "tags", label: "Tags", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "marketing_consent", label: "Marketing Consent", required: false },
  ],
  bookings: [
    { key: "contact_email", label: "Contact Email", required: true },
    { key: "contact_name", label: "Contact Name", required: false },
    { key: "contact_phone", label: "Contact Phone", required: false },
    { key: "date", label: "Date", required: true },
    { key: "timeslot", label: "Timeslot", required: false },
    { key: "program_name", label: "Program Name", required: false },
    { key: "kids_count", label: "Kids Count", required: false },
    { key: "adults_count", label: "Adults Count", required: false },
    { key: "notes", label: "Notes", required: false },
  ],
  members: [
    { key: "contact_email", label: "Contact Email", required: true },
    { key: "contact_name", label: "Contact Name", required: false },
    { key: "membership_type", label: "Membership Type", required: true },
    { key: "start_date", label: "Start Date", required: false },
    { key: "end_date", label: "End Date", required: false },
    { key: "status", label: "Status", required: false },
    { key: "code", label: "Code", required: false },
  ],
};

// ─── Auto-mapping ────────────────────────────────────────────────────────────

const AUTO_MAP: Record<string, string[]> = {
  email: ["email", "e-mail", "email address", "emailaddress", "e_mail"],
  name: ["name", "full name", "fullname", "full_name", "contact name", "contact_name"],
  phone: ["phone", "phone number", "phonenumber", "mobile", "cell", "telephone"],
  contact_email: ["email", "e-mail", "email address", "contact email", "contact_email"],
  contact_name: ["name", "full name", "fullname", "contact name", "contact_name"],
  contact_phone: ["phone", "phone number", "mobile", "cell"],
  date: ["date", "appointment date", "booking date", "appt date", "visit date"],
  timeslot: ["timeslot", "time slot", "time", "appointment time", "appt time"],
  program_name: ["program", "program name", "service", "appointment type", "type"],
  kids_count: ["kids", "children", "# of kids", "kids_attending", "kids count", "num kids", "number of kids"],
  adults_count: ["adults", "# of adults", "adults count", "num adults"],
  notes: ["notes", "note", "comments", "comment"],
  contact_types: ["contact type", "contact_types", "type"],
  organization: ["organization", "company", "org"],
  tags: ["tags", "tag"],
  marketing_consent: ["marketing consent", "consent", "marketing", "opt in", "opt-in"],
  membership_type: ["membership type", "membership", "plan", "tier"],
  start_date: ["start date", "start_date", "membership start", "from"],
  end_date: ["end date", "end_date", "membership end", "expiry", "expires"],
  status: ["status"],
  code: ["code", "member code", "membership code"],
};

function autoMap(
  headers: string[],
  importType: ImportType
): Record<string, string> {
  const result: Record<string, string> = {};
  const fields = CRM_FIELDS[importType];

  for (const field of fields) {
    const patterns = AUTO_MAP[field.key] ?? [];
    for (const header of headers) {
      const norm = header.toLowerCase().trim();
      if (patterns.includes(norm)) {
        result[field.key] = header;
        break;
      }
    }
  }
  return result;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FailedRow {
  rowNum: number;
  reason: string;
  data: Record<string, string>;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: FailedRow[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminPage() {
  // Tags panel state
  const [contacts, setContacts] = useState<{ tags: string[] | null }[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Import state
  const [importType, setImportType] = useState<ImportType>("contacts");
  const [importStep, setImportStep] = useState<"upload" | "map" | "result">("upload");
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showFailed, setShowFailed] = useState(false);

  // Admin management state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchAdminUsers() {
    setLoadingAdminUsers(true);
    setAdminUsersError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const { users } = await res.json();
      setAdminUsers(users);
    } catch {
      setAdminUsersError("Could not load users.");
    } finally {
      setLoadingAdminUsers(false);
    }
  }

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    setTogglingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, makeAdmin }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isAdmin: makeAdmin } : u))
      );
    } catch {
      setAdminUsersError("Failed to update user role.");
    } finally {
      setTogglingId(null);
    }
  }

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase.from("contacts").select("tags");
    setLoadingTags(false);
    setContacts((data as { tags: string[] | null }[]) ?? []);
  }

  useEffect(() => {
    fetchTags();
    fetchAdminUsers();
  }, []);

  const allTags = Array.from(
    new Set(contacts.flatMap((c) => c.tags ?? []).filter(Boolean))
  ).sort();

  // ── File handling ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const rows = await parseFile(file);
      if (!rows.length) {
        setParseError("File has no data rows.");
        e.target.value = "";
        return;
      }
      const headers = Object.keys(rows[0]);
      setFileRows(rows);
      setFileHeaders(headers);
      setColumnMap(autoMap(headers, importType));
      setImportStep("map");
    } catch {
      setParseError("Failed to parse file. Check that it's a valid CSV or Excel file.");
    }
    e.target.value = "";
  }

  function handleImportTypeChange(val: ImportType) {
    setImportType(val);
    // Re-run auto-map if headers are already loaded
    if (fileHeaders.length) {
      setColumnMap(autoMap(fileHeaders, val));
    }
  }

  function resetImport() {
    setImportStep("upload");
    setFileRows([]);
    setFileHeaders([]);
    setColumnMap({});
    setParseError(null);
    setImportResult(null);
    setImportProgress(0);
    setShowFailed(false);
  }

  // ── Import execution ───────────────────────────────────────────────────────

  async function runImport() {
    setImporting(true);
    setImportProgress(0);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failed: FailedRow[] = [];

    for (let i = 0; i < fileRows.length; i++) {
      const row = fileRows[i];
      setImportProgress(Math.round(((i + 1) / fileRows.length) * 100));

      try {
        if (importType === "contacts") {
          const result = await importContactRow(row, columnMap);
          if (result === "created") created++;
          else if (result === "updated") updated++;
          else skipped++;
        } else if (importType === "bookings") {
          const result = await importBookingRow(row, columnMap);
          if (result === "created") created++;
          else skipped++;
        } else if (importType === "members") {
          const result = await importMemberRow(row, columnMap);
          if (result === "created") created++;
          else skipped++;
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        failed.push({ rowNum: i + 2, reason, data: row });
      }
    }

    setImportResult({ created, updated, skipped, failed });
    setImporting(false);
    setImportStep("result");
    fetchTags();
  }

  // ─── Import row functions ─────────────────────────────────────────────────

  async function importContactRow(
    row: Record<string, string>,
    map: Record<string, string>
  ): Promise<"created" | "updated" | "skipped"> {
    const email = map.email ? row[map.email]?.trim() || null : null;
    const name = map.name ? row[map.name]?.trim() || null : null;
    const phone = map.phone ? row[map.phone]?.trim() || null : null;
    const contactTypes = map.contact_types
      ? parseArr(row[map.contact_types] ?? "")
      : [];
    const tags = map.tags ? parseArr(row[map.tags] ?? "") : [];
    const organization = map.organization
      ? row[map.organization]?.trim() || null
      : null;
    const notes = map.notes ? row[map.notes]?.trim() || null : null;
    const marketingConsentRaw = map.marketing_consent
      ? row[map.marketing_consent]?.trim().toLowerCase()
      : null;
    const marketingConsent = marketingConsentRaw
      ? ["yes", "true", "1"].includes(marketingConsentRaw)
      : null;

    if (!name && !email) return "skipped";

    if (email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        const updates: Record<string, unknown> = {};
        if (!existing.name && name) updates.name = name;
        if (!existing.phone && phone) updates.phone = phone;
        if (Object.keys(updates).length) {
          const { error } = await supabase
            .from("contacts")
            .update(updates)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          return "updated";
        }
        return "skipped";
      }
    }

    const { error } = await supabase.from("contacts").insert({
      name,
      email,
      phone,
      contact_types: contactTypes.length ? contactTypes : null,
      organization,
      tags: tags.length ? tags : null,
      notes,
      marketing_consent: marketingConsent,
    });
    if (error) throw new Error(error.message);
    return "created";
  }

  async function importBookingRow(
    row: Record<string, string>,
    map: Record<string, string>
  ): Promise<"created" | "skipped"> {
    const email = map.contact_email ? row[map.contact_email]?.trim() : null;
    if (!email) throw new Error("Missing contact email");

    const dateStr = map.date ? row[map.date]?.trim() : null;
    if (!dateStr) throw new Error("Missing date");
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) throw new Error(`Invalid date: ${dateStr}`);

    const contactName = map.contact_name
      ? row[map.contact_name]?.trim() || null
      : null;
    const contactPhone = map.contact_phone
      ? row[map.contact_phone]?.trim() || null
      : null;

    // Find or create contact
    let contactId: string;
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: newContact, error: insertErr } = await supabase
        .from("contacts")
        .insert({ email, name: contactName, phone: contactPhone })
        .select("id")
        .single();
      if (insertErr || !newContact) throw new Error(insertErr?.message ?? "Failed to create contact");
      contactId = newContact.id;
    }

    const kidsCount = map.kids_count
      ? parseInt(row[map.kids_count] ?? "0") || 0
      : 0;
    const adultsCount = map.adults_count
      ? parseInt(row[map.adults_count] ?? "0") || 0
      : 0;

    const { error } = await supabase.from("bookings").insert({
      contact_id: contactId,
      date: parsedDate,
      timeslot: map.timeslot ? row[map.timeslot]?.trim() || null : null,
      program_name: map.program_name ? row[map.program_name]?.trim() || null : null,
      kids_count: kidsCount,
      booking_type: "import",
      notes: map.notes ? row[map.notes]?.trim() || null : null,
      report_data: {
        children_count: kidsCount,
        adults_count: adultsCount,
      },
    });
    if (error) throw new Error(error.message);
    return "created";
  }

  async function importMemberRow(
    row: Record<string, string>,
    map: Record<string, string>
  ): Promise<"created" | "skipped"> {
    const email = map.contact_email ? row[map.contact_email]?.trim() : null;
    if (!email) throw new Error("Missing contact email");

    const membershipType = map.membership_type
      ? row[map.membership_type]?.trim() || null
      : null;
    if (!membershipType) throw new Error("Missing membership type");

    const contactName = map.contact_name
      ? row[map.contact_name]?.trim() || null
      : null;

    // Find or create contact
    let contactId: string;
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: newContact, error: insertErr } = await supabase
        .from("contacts")
        .insert({ email, name: contactName })
        .select("id")
        .single();
      if (insertErr || !newContact) throw new Error(insertErr?.message ?? "Failed to create contact");
      contactId = newContact.id;
    }

    const { error } = await supabase.from("members").insert({
      contact_id: contactId,
      membership_type: membershipType,
      start_date: map.start_date ? parseDate(row[map.start_date] ?? "") || null : null,
      end_date: map.end_date ? parseDate(row[map.end_date] ?? "") || null : null,
      status: map.status ? row[map.status]?.trim() || null : null,
      code: map.code ? row[map.code]?.trim() || null : null,
    });
    if (error) throw new Error(error.message);
    return "created";
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const fields = CRM_FIELDS[importType];
  const previewRows = fileRows.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Tools</h1>
        <p className="text-muted-foreground">
          Import contacts, bookings, or members from CSV or Excel files.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Import card ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import</CardTitle>
              <CardDescription>
                Upload a .csv, .xlsx, or .xls file and map columns to CRM
                fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step: upload */}
              {importStep === "upload" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Import type</label>
                    <Select
                      value={importType}
                      onValueChange={(v) =>
                        handleImportTypeChange(v as ImportType)
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contacts">Contacts</SelectItem>
                        <SelectItem value="bookings">Bookings</SelectItem>
                        <SelectItem value="members">Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Choose file
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supported: .csv, .xlsx, .xls
                    </p>
                  </div>

                  {parseError && (
                    <p className="text-sm text-destructive">{parseError}</p>
                  )}
                </div>
              )}

              {/* Step: map */}
              {importStep === "map" && (
                <div className="space-y-6">
                  {/* Import type selector (still editable) */}
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Import type</label>
                      <Select
                        value={importType}
                        onValueChange={(v) =>
                          handleImportTypeChange(v as ImportType)
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contacts">Contacts</SelectItem>
                          <SelectItem value="bookings">Bookings</SelectItem>
                          <SelectItem value="members">Members</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="self-end text-sm text-muted-foreground">
                      {fileRows.length} rows detected
                    </div>
                  </div>

                  {/* Column mapper */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Column mapping
                    </h3>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium">
                              CRM field
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              File column
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Sample
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field) => {
                            const mappedCol = columnMap[field.key];
                            const sample = mappedCol
                              ? fileRows[0]?.[mappedCol]
                              : undefined;
                            return (
                              <tr
                                key={field.key}
                                className="border-b last:border-0"
                              >
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{field.label}</span>
                                    {field.required && (
                                      <Badge
                                        variant="destructive"
                                        className="text-[10px] px-1 py-0 h-4"
                                      >
                                        required
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <Select
                                    value={mappedCol ?? "__skip__"}
                                    onValueChange={(v) =>
                                      setColumnMap((prev) => ({
                                        ...prev,
                                        [field.key]:
                                          v === "__skip__" ? "" : v,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-48 h-8 text-xs">
                                      <SelectValue placeholder="— skip —" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__skip__">
                                        — skip —
                                      </SelectItem>
                                      {fileHeaders.map((h) => (
                                        <SelectItem key={h} value={h}>
                                          {h}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[160px]">
                                  {sample ?? ""}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Preview */}
                  {previewRows.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">
                        Preview (first {previewRows.length} rows)
                      </h3>
                      <div className="overflow-x-auto border rounded-md">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              {fields
                                .filter((f) => columnMap[f.key])
                                .map((f) => (
                                  <th
                                    key={f.key}
                                    className="text-left px-3 py-2 font-medium whitespace-nowrap"
                                  >
                                    {f.label}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, i) => (
                              <tr key={i} className="border-b last:border-0">
                                {fields
                                  .filter((f) => columnMap[f.key])
                                  .map((f) => (
                                    <td
                                      key={f.key}
                                      className="px-3 py-1.5 truncate max-w-[140px]"
                                    >
                                      {row[columnMap[f.key]] ?? ""}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button onClick={runImport} disabled={importing}>
                      {importing
                        ? `Importing… ${importProgress}%`
                        : `Import ${fileRows.length} rows`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetImport}
                      disabled={importing}
                    >
                      Cancel
                    </Button>
                  </div>

                  {/* Progress bar */}
                  {importing && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step: result */}
              {importStep === "result" && importResult && (
                <div className="space-y-4">
                  <div className="rounded-md bg-green-50 border border-green-200 p-4 space-y-1">
                    <p className="font-semibold text-green-800">
                      Import complete
                    </p>
                    <div className="text-sm text-green-700 space-y-0.5">
                      <p>{importResult.created} created</p>
                      {importResult.updated > 0 && (
                        <p>{importResult.updated} updated</p>
                      )}
                      {importResult.skipped > 0 && (
                        <p>{importResult.skipped} skipped (no changes needed)</p>
                      )}
                      {importResult.failed.length > 0 && (
                        <p className="text-red-600">
                          {importResult.failed.length} failed
                        </p>
                      )}
                    </div>
                  </div>

                  {importResult.failed.length > 0 && (
                    <div>
                      <button
                        className="text-sm underline text-muted-foreground"
                        onClick={() => setShowFailed((v) => !v)}
                      >
                        {showFailed ? "Hide" : "Show"} failed rows (
                        {importResult.failed.length})
                      </button>
                      {showFailed && (
                        <div className="mt-2 overflow-x-auto border rounded-md">
                          <table className="text-xs w-full">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left px-3 py-2">Row</th>
                                <th className="text-left px-3 py-2">Reason</th>
                                <th className="text-left px-3 py-2">Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importResult.failed.map((f, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-1.5">{f.rowNum}</td>
                                  <td className="px-3 py-1.5 text-destructive">
                                    {f.reason}
                                  </td>
                                  <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[240px]">
                                    {Object.entries(f.data)
                                      .slice(0, 3)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(", ")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  <Button onClick={resetImport}>Import another file</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* Tags panel */}
          <Card>
            <CardHeader>
              <CardTitle>Tags in use</CardTitle>
              <CardDescription>
                Unique tags across all contacts (read-only).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTags ? (
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

          {/* Manage admins */}
          <Card>
            <CardHeader>
              <CardTitle>Manage Admins</CardTitle>
              <CardDescription>
                Grant or revoke admin access for any user.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingAdminUsers && (
                <p className="text-muted-foreground text-sm">Loading…</p>
              )}
              {adminUsersError && (
                <p className="text-sm text-destructive">{adminUsersError}</p>
              )}
              {!loadingAdminUsers && adminUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {u.name || u.email}
                    </p>
                    {u.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.isAdmin && (
                      <Badge variant="secondary" className="text-xs">
                        admin
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant={u.isAdmin ? "outline" : "default"}
                      disabled={togglingId === u.id}
                      onClick={() => toggleAdmin(u.id, !u.isAdmin)}
                    >
                      {togglingId === u.id
                        ? "…"
                        : u.isAdmin
                        ? "Revoke"
                        : "Grant"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
