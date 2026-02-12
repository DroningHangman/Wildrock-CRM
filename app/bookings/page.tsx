"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Booking, Contact } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BookingRow extends Booking {
  contacts?: Contact | null;
}

type QuickFilter = "today" | "week" | "month" | "all";

// Program quick filters - maps display labels to Cal.com event type slugs
const PROGRAM_QUICK_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Field Trip", value: "wildrock-field-trip" },
  { label: "Birthday Party", value: "birthday-party" },
];

// Event type field mappings - defines which fields to show for each event type
const EVENT_FIELD_MAPPINGS: Record<string, { label: string; priority: number }[]> = {
  // Summer Camp example
  "summer_camp": [
    { label: "emergency_contact", priority: 1 },
    { label: "allergies", priority: 2 },
    { label: "swimming_level", priority: 3 },
    { label: "parent_phone", priority: 4 },
  ],
  // Winter Workshop example
  "winter_workshop": [
    { label: "skill_level", priority: 1 },
    { label: "equipment_needed", priority: 2 },
    { label: "dietary_restrictions", priority: 3 },
  ],
  // Birthday Party example
  "birthday_party": [
    { label: "number_of_guests", priority: 1 },
    { label: "cake_preference", priority: 2 },
    { label: "special_requests", priority: 3 },
  ],
};

// Helper function to extract clean value from Cal.com response format
// Cal.com sends: {"label":"field_name","value":"actual_value","isHidden":false}
function extractCleanValue(field: unknown): string {
  if (!field || typeof field !== 'object') return '—'
  const obj = field as Record<string, unknown>
  
  // Skip hidden fields
  if (obj.isHidden === true) return '—'
  
  // Extract value
  if (typeof obj.value === 'string') return obj.value
  if (typeof obj.value === 'number') return String(obj.value)
  if (typeof obj.value === 'boolean') return obj.value ? 'Yes' : 'No'
  if (Array.isArray(obj.value)) {
    if (obj.value.length === 0) return 'None'
    return obj.value.map(v => typeof v === 'string' ? v : String(v)).join(', ')
  }
  if (typeof obj.value === 'object' && obj.value !== null) {
    const nested = obj.value as Record<string, unknown>
    // Handle nested value objects like location: {"value":"address","optionValue":""}
    if (typeof nested.value === 'string') return nested.value
    if (typeof nested.value === 'number') return String(nested.value)
  }
  
  return '—'
}

// Helper function to get clean label from Cal.com response format
function extractLabel(field: unknown, fallbackKey: string): string {
  if (!field || typeof field !== 'object') return fallbackKey.replace(/_/g, ' ')
  const obj = field as Record<string, unknown>
  if (typeof obj.label === 'string') return obj.label
  return fallbackKey.replace(/_/g, ' ')
}

// Helper function to get relevant fields for an event type
function getRelevantFields(bookingType: string | null, formResponses: Record<string, unknown> | null | undefined) {
  if (!formResponses) return [];
  
  // Filter out hidden fields and extract clean values
  const allFields = Object.entries(formResponses)
    .filter((entry) => {
      const value = entry[1]
      if (!value || typeof value !== 'object') return true
      const obj = value as Record<string, unknown>
      return obj.isHidden !== true // Skip hidden fields
    })
    .map(([key, value]) => ({
      key,
      value: extractCleanValue(value),
      label: extractLabel(value, key),
      priority: 999
    }))
    .filter(field => field.value !== '—') // Remove empty/hidden fields
  
  if (!bookingType) return allFields
  
  const mapping = EVENT_FIELD_MAPPINGS[bookingType];
  if (!mapping) {
    // If no mapping exists, show all fields (fallback)
    return allFields
  }
  
  // Get fields from mapping that exist in formResponses
  const relevantFields = mapping
    .filter(field => formResponses.hasOwnProperty(field.label))
    .map(field => ({
      key: field.label,
      value: extractCleanValue(formResponses[field.label]),
      label: extractLabel(formResponses[field.label], field.label),
      priority: field.priority
    }))
    .filter(field => field.value !== '—') // Remove empty/hidden fields
    .sort((a, b) => a.priority - b.priority);
  
  return relevantFields;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  
  // Filters
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("today");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [contactFilter, setContactFilter] = useState<string>("all");
  const [contactSearch, setContactSearch] = useState<string>("");

  const applyQuickFilter = useCallback((filter: QuickFilter) => {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setActiveFilter(filter);

    if (filter === "today") {
      const d = current.toISOString().split("T")[0];
      setDateFrom(d);
      setDateTo(d);
    } else if (filter === "week") {
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(current.setDate(diff));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setDateFrom(start.toISOString().split("T")[0]);
      setDateTo(end.toISOString().split("T")[0]);
    } else if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(start.toISOString().split("T")[0]);
      setDateTo(end.toISOString().split("T")[0]);
    } else if (filter === "all") {
      setDateFrom("");
      setDateTo("");
    }
  }, []);

  async function fetchBookings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*, contacts(*)")
      .order("date", { ascending: false });
    if (error) {
      console.error("Error fetching bookings:", error);
      setBookings([]);
    } else {
      setBookings((data as BookingRow[]) ?? []);
    }
    setLoading(false);
  }

  async function fetchContacts() {
    const { data } = await supabase.from("contacts").select("id, name, email").order("name", { nullsFirst: false });
    setContacts((data as Contact[]) ?? []);
  }

  useEffect(() => {
    fetchBookings();
    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const searchLower = contactSearch.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(searchLower) || 
           (c.email ?? "").toLowerCase().includes(searchLower);
  });

  const programNames = Array.from(
    new Set(bookings.map((b) => b.program_name).filter(Boolean) as string[])
  ).sort();

  const filtered = bookings.filter((b) => {
    const d = b.date ?? "";
    const matchDate = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    const matchProgram = programFilter === "all" || b.program_name === programFilter;
    const matchContact = contactFilter === "all" || b.contact_id === contactFilter;
    return matchDate && matchProgram && matchContact;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">
            Event bookings synced from Cal.com. (Read-only)
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <Label htmlFor="dateFrom">Date from</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActiveFilter("all");
                }}
                className="mt-1 w-[160px]"
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Date to</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActiveFilter("all");
                }}
                className="mt-1 w-[160px]"
              />
            </div>
            <div className="w-[200px]">
              <Label>Program</Label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {programNames.map((p) => (
                    <SelectItem key={p} value={p!}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px]">
              <Label>Contact</Label>
              <Select value={contactFilter} onValueChange={setContactFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="h-8"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">All</SelectItem>
                    {filteredContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name ?? "—"}
                      </SelectItem>
                    ))}
                    {filteredContacts.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No contacts found</div>
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 mb-6 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Date:</span>
              <div className="flex gap-2">
                <Button variant={activeFilter === "today" ? "default" : "outline"} size="sm" onClick={() => applyQuickFilter("today")}>Today</Button>
                <Button variant={activeFilter === "week" ? "default" : "outline"} size="sm" onClick={() => applyQuickFilter("week")}>This Week</Button>
                <Button variant={activeFilter === "month" ? "default" : "outline"} size="sm" onClick={() => applyQuickFilter("month")}>This Month</Button>
                <Button variant={activeFilter === "all" && !dateFrom && !dateTo ? "default" : "outline"} size="sm" onClick={() => applyQuickFilter("all")}>Clear Dates</Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Program:</span>
              <div className="flex gap-2">
                {PROGRAM_QUICK_FILTERS.map(({ label, value }) => (
                  <Button
                    key={value}
                    variant={programFilter === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProgramFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Timeslot</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Kids</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow 
                    key={b.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedBooking(b)}
                  >
                    <TableCell>{b.date ?? "—"}</TableCell>
                    <TableCell>{b.timeslot ?? "—"}</TableCell>
                    <TableCell>{b.program_name ?? "—"}</TableCell>
                    <TableCell>{b.contacts?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{b.kids_count ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">No bookings match your filters.</p>
          )}
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              {selectedBooking?.contacts?.name} - {selectedBooking?.program_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">{selectedBooking.date ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Timeslot</Label>
                  <p className="font-medium">{selectedBooking.timeslot ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Booking Type</Label>
                  <p className="font-medium">{selectedBooking.booking_type ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Kids Count</Label>
                  <p className="font-medium">{selectedBooking.kids_count ?? 0}</p>
                </div>
              </div>

              {selectedBooking.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Form Responses Section - Clean Display */}
              {selectedBooking.form_responses && Object.keys(selectedBooking.form_responses).length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-3 block">
                    {selectedBooking.booking_type 
                      ? `${selectedBooking.booking_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Details`
                      : 'Form Responses'}
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getRelevantFields(selectedBooking.booking_type, selectedBooking.form_responses).map(({ key, value, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {label}
                        </Label>
                        <p className="text-sm font-medium">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
