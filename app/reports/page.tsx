"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Contact,
  Entity,
  Booking,
  ProgramType,
  ProgramEntry,
  FieldDefinition,
  FieldSchema,
} from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Maps program_types.slug → bookings.program_name for booking-sourced reports
const BOOKING_SOURCE_MAP: Record<string, string> = {
  "birthday-party": "birthday-party",
  "field-trip": "wildrock-field-trip",
};

// Maps schema field keys → booking column extractors for auto-population
const BOOKING_FIELD_DEFAULTS: Record<string, (b: Booking) => unknown> = {
  children_count: (b) => b.kids_count ?? 0,
};

export default function ReportsPage() {
  const [programTypes, setProgramTypes] = useState<ProgramType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [entries, setEntries] = useState<ProgramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Date range
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Entry form (add/edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formNotes, setFormNotes] = useState("");
  const [formContactId, setFormContactId] = useState("");
  const [formContactSearch, setFormContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [formEntityId, setFormEntityId] = useState("");
  const [formEntitySearch, setFormEntitySearch] = useState("");
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lookup data for contact/entity pickers
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);

  const selectedType = programTypes.find((t) => t.id === selectedTypeId);
  const schema: FieldSchema | null = selectedType?.field_schema ?? null;
  const isBookingSourced = selectedType
    ? !!BOOKING_SOURCE_MAP[selectedType.slug]
    : false;

  // For booking-sourced types, exclude boolean fields since they don't aggregate
  const displayFields = useMemo(() => {
    if (!schema) return [];
    if (isBookingSourced) {
      return schema.fields.filter((f) => f.type !== "boolean");
    }
    return schema.fields;
  }, [schema, isBookingSourced]);

  /* ── Fetch ── */

  const fetchProgramTypes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("program_types")
      .select("*")
      .order("name");
    if (error) {
      console.error("Error fetching program types:", error);
    } else {
      const types = (data as ProgramType[]) ?? [];
      setProgramTypes(types);
      if (types.length > 0 && !selectedTypeId) {
        setSelectedTypeId(types[0].id);
      }
    }
    setLoading(false);
  }, [selectedTypeId]);

  const fetchEntries = useCallback(async () => {
    if (!selectedTypeId) return;
    setLoadingEntries(true);

    const type = programTypes.find((t) => t.id === selectedTypeId);
    const bookingProgramName = type
      ? BOOKING_SOURCE_MAP[type.slug]
      : undefined;
    const fieldSchema: FieldSchema | null = type?.field_schema ?? null;

    if (bookingProgramName) {
      let query = supabase
        .from("bookings")
        .select("*, contacts(id, name)")
        .eq("program_name", bookingProgramName)
        .order("date", { ascending: false });

      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching bookings for report:", error);
        setEntries([]);
      } else {
        const transformed: ProgramEntry[] = ((data as Booking[]) || []).map(
          (booking) => {
            const rd = (booking.report_data || {}) as Record<string, unknown>;
            const entryData: Record<string, unknown> = {};

            for (const field of fieldSchema?.fields || []) {
              if (rd[field.key] !== undefined) {
                entryData[field.key] = rd[field.key];
              } else {
                const defaultFn = BOOKING_FIELD_DEFAULTS[field.key];
                if (defaultFn) {
                  entryData[field.key] = defaultFn(booking);
                }
              }
            }

            return {
              id: booking.id,
              program_type_id: selectedTypeId,
              date: booking.date ?? "",
              contact_id: booking.contact_id,
              entity_id: null,
              data: entryData,
              notes: booking.notes,
              contacts: booking.contacts
                ? { id: booking.contacts.id, name: booking.contacts.name }
                : null,
              entities: null,
            };
          }
        );
        setEntries(transformed);
      }
    } else {
      let query = supabase
        .from("program_entries")
        .select("*, contacts(id, name), entities(id, name)")
        .eq("program_type_id", selectedTypeId)
        .order("date", { ascending: false });

      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching entries:", error);
        setEntries([]);
      } else {
        setEntries((data as ProgramEntry[]) ?? []);
      }
    }

    setLoadingEntries(false);
  }, [selectedTypeId, programTypes, dateFrom, dateTo]);

  useEffect(() => {
    fetchProgramTypes();
  }, [fetchProgramTypes]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const fetchLookupData = useCallback(async () => {
    const [contactsRes, entitiesRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("*")
        .order("name", { nullsFirst: false }),
      supabase.from("entities").select("*").order("name"),
    ]);
    setAllContacts((contactsRes.data as Contact[]) ?? []);
    setAllEntities((entitiesRes.data as Entity[]) ?? []);
  }, []);

  /* ── Aggregations ── */

  const aggregations = useMemo(() => {
    if (!schema?.aggregations?.length) return null;
    const agg: Record<string, number> = {};
    for (const key of schema.aggregations) {
      agg[key] = entries.reduce((sum, e) => {
        const val = Number(e.data[key]) || 0;
        return sum + val;
      }, 0);
    }
    return agg;
  }, [entries, schema]);

  /* ── Entry CRUD ── */

  function openAddForm() {
    setEditingEntryId(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormData({});
    setFormNotes("");
    setFormContactId("");
    setFormContactSearch("");
    setFormEntityId("");
    setFormEntitySearch("");
    setIsFormOpen(true);
    if (schema?.show_contact || schema?.show_entity) {
      fetchLookupData();
    }
  }

  function openEditForm(entry: ProgramEntry) {
    setEditingEntryId(entry.id);
    setFormDate(entry.date);
    setFormData({ ...entry.data });
    setFormNotes(entry.notes ?? "");
    if (!isBookingSourced) {
      setFormContactId(entry.contact_id ?? "");
      setFormContactSearch(entry.contacts?.name ?? "");
      setFormEntityId(entry.entity_id ?? "");
      setFormEntitySearch(entry.entities?.name ?? "");
      if (schema?.show_contact || schema?.show_entity) {
        fetchLookupData();
      }
    }
    setIsFormOpen(true);
  }

  async function saveEntry() {
    if (isBookingSourced) {
      if (!editingEntryId) return;
      setSaving(true);
      const { error } = await supabase
        .from("bookings")
        .update({ report_data: formData })
        .eq("id", editingEntryId);
      if (error) {
        alert("Failed to update entry");
        setSaving(false);
        return;
      }
      setSaving(false);
      setIsFormOpen(false);
      fetchEntries();
      return;
    }

    if (!selectedTypeId || !formDate) {
      alert("Date is required");
      return;
    }
    setSaving(true);

    const payload = {
      program_type_id: selectedTypeId,
      date: formDate,
      data: formData,
      notes: formNotes || null,
      contact_id: formContactId || null,
      entity_id: formEntityId || null,
    };

    if (editingEntryId) {
      const { error } = await supabase
        .from("program_entries")
        .update(payload)
        .eq("id", editingEntryId);
      if (error) {
        alert("Failed to update entry");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("program_entries").insert(payload);
      if (error) {
        alert("Failed to add entry");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setIsFormOpen(false);
    fetchEntries();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase
      .from("program_entries")
      .delete()
      .eq("id", id);
    if (error) {
      alert("Failed to delete entry");
      return;
    }
    fetchEntries();
  }

  /* ── Field rendering helpers ── */

  function setFieldValue(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function renderFieldInput(field: FieldDefinition) {
    const value = formData[field.key];
    switch (field.type) {
      case "number":
        return (
          <Input
            type="number"
            value={value != null ? String(value) : ""}
            onChange={(e) =>
              setFieldValue(
                field.key,
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          />
        );
      case "currency":
        return (
          <Input
            type="number"
            step="0.01"
            value={value != null ? String(value) : ""}
            onChange={(e) =>
              setFieldValue(
                field.key,
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          />
        );
      case "boolean":
        return (
          <div className="flex items-center h-9">
            <Checkbox
              checked={value === true}
              onCheckedChange={(checked) =>
                setFieldValue(field.key, checked === true)
              }
            />
          </div>
        );
      default:
        return (
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setFieldValue(field.key, e.target.value)}
          />
        );
    }
  }

  function renderCellValue(field: FieldDefinition, value: unknown) {
    if (value == null) return "—";
    switch (field.type) {
      case "boolean":
        return value === true ? (
          <Badge variant="default" className="bg-green-600">
            Yes
          </Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        );
      case "currency":
        return `$${Number(value).toFixed(2)}`;
      default:
        return String(value);
    }
  }

  /* ── Searchable pickers ── */

  const filteredContacts = allContacts.filter((c) => {
    if (!formContactSearch) return true;
    const q = formContactSearch.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const filteredEntities = allEntities.filter((e) => {
    if (!formEntitySearch) return true;
    return e.name.toLowerCase().includes(formEntitySearch.toLowerCase());
  });

  /* ── Render ── */

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Program tracking and analytics.
          </p>
        </div>
        {selectedType && !isBookingSourced && (
          <Button onClick={openAddForm}>Add Entry</Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-[200px]">
              <Label>Program</Label>
              <Select
                value={selectedTypeId}
                onValueChange={setSelectedTypeId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {programTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-[160px]">
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear dates
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Booking source indicator */}
        {isBookingSourced && (
          <div className="px-6 pb-2">
            <p className="text-sm text-muted-foreground">
              Sourced from Cal.com bookings. Use the edit button to add tracking
              details.
            </p>
          </div>
        )}

        {/* Aggregation bar */}
        {aggregations && Object.keys(aggregations).length > 0 && (
          <div className="px-6 pb-4">
            <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap gap-6">
              {displayFields
                .filter((f) => schema?.aggregations?.includes(f.key))
                .map((f) => (
                  <div key={f.key}>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-xl font-semibold">
                      {f.type === "currency"
                        ? `$${aggregations[f.key].toFixed(2)}`
                        : aggregations[f.key].toLocaleString()}
                    </p>
                  </div>
                ))}
              <div>
                <p className="text-xs text-muted-foreground">Entries</p>
                <p className="text-xl font-semibold">{entries.length}</p>
              </div>
            </div>
          </div>
        )}

        <CardContent>
          {loadingEntries ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : !schema ? (
            <p className="text-muted-foreground py-8 text-center">
              Select a program to view its report.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {schema.show_contact && <TableHead>Contact</TableHead>}
                  {schema.show_entity && !isBookingSourced && (
                    <TableHead>Entity</TableHead>
                  )}
                  {displayFields.map((f) => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                  {!isBookingSourced && <TableHead>Notes</TableHead>}
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.date}</TableCell>
                    {schema.show_contact && (
                      <TableCell>
                        {entry.contacts?.name ?? "—"}
                      </TableCell>
                    )}
                    {schema.show_entity && !isBookingSourced && (
                      <TableCell>
                        {entry.entities?.name ?? "—"}
                      </TableCell>
                    )}
                    {displayFields.map((f) => (
                      <TableCell key={f.key}>
                        {renderCellValue(f, entry.data[f.key])}
                      </TableCell>
                    ))}
                    {!isBookingSourced && (
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {entry.notes ?? "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditForm(entry)}
                        >
                          Edit
                        </Button>
                        {!isBookingSourced && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteEntry(entry.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        displayFields.length +
                        2 +
                        (schema.show_contact ? 1 : 0) +
                        (schema.show_entity && !isBookingSourced ? 1 : 0) +
                        (!isBookingSourced ? 1 : 0)
                      }
                      className="text-center text-muted-foreground py-8"
                    >
                      {isBookingSourced
                        ? "No bookings found. Bookings sync automatically from Cal.com."
                        : "No entries yet. Click \"Add Entry\" to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add/Edit Entry Dialog ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isBookingSourced
                ? `Update ${selectedType?.name} Details`
                : `${editingEntryId ? "Edit" : "Add"} ${selectedType?.name} Entry`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Date (non-booking only) */}
            {!isBookingSourced && (
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            )}

            {/* Contact picker (non-booking only) */}
            {!isBookingSourced && schema?.show_contact && (
              <div className="space-y-2">
                <Label>Contact</Label>
                <div className="relative">
                  <Input
                    value={formContactSearch}
                    onChange={(e) => {
                      setFormContactSearch(e.target.value);
                      setFormContactId("");
                      setShowContactDropdown(true);
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    placeholder="Search contacts…"
                  />
                  {showContactDropdown && !formContactId && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No contacts found
                        </div>
                      ) : (
                        filteredContacts.slice(0, 20).map((c) => (
                          <div
                            key={c.id}
                            className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormContactId(c.id);
                              setFormContactSearch(c.name ?? c.email ?? "");
                              setShowContactDropdown(false);
                            }}
                          >
                            <span className="font-medium">
                              {c.name ?? "Unnamed"}
                            </span>
                            {c.email && (
                              <span className="text-muted-foreground ml-2">
                                {c.email}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Entity picker (non-booking only) */}
            {!isBookingSourced && schema?.show_entity && (
              <div className="space-y-2">
                <Label>School / Organization</Label>
                <div className="relative">
                  <Input
                    value={formEntitySearch}
                    onChange={(e) => {
                      setFormEntitySearch(e.target.value);
                      setFormEntityId("");
                      setShowEntityDropdown(true);
                    }}
                    onFocus={() => setShowEntityDropdown(true)}
                    placeholder="Search entities…"
                  />
                  {showEntityDropdown && !formEntityId && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                      {filteredEntities.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No entities found
                        </div>
                      ) : (
                        filteredEntities.slice(0, 20).map((e) => (
                          <div
                            key={e.id}
                            className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex items-center gap-2"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => {
                              setFormEntityId(e.id);
                              setFormEntitySearch(e.name);
                              setShowEntityDropdown(false);
                            }}
                          >
                            <span className="font-medium">{e.name}</span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {e.entity_type === "household"
                                ? "Household"
                                : e.entity_type === "school"
                                  ? "School"
                                  : "Organization"}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic fields */}
            {displayFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                {renderFieldInput(field)}
              </div>
            ))}

            {/* Notes (non-booking only) */}
            {!isBookingSourced && (
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={saving}>
              {isBookingSourced
                ? "Save Details"
                : editingEntryId
                  ? "Save Changes"
                  : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
