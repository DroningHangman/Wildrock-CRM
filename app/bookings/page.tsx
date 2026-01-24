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

interface BookingRow extends Booking {
  contacts?: Contact | null;
}

type QuickFilter = "today" | "week" | "month" | "all";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Set default to today
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("today");
  
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [contactFilter, setContactFilter] = useState<string>("all");

  const applyQuickFilter = useCallback((filter: QuickFilter) => {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setActiveFilter(filter);

    if (filter === "today") {
      const d = current.toISOString().split("T")[0];
      setDateFrom(d);
      setDateTo(d);
    } else if (filter === "week") {
      // Start of week (Monday)
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
    const { data } = await supabase.from("contacts").select("id, name").order("name", { nullsFirst: false });
    setContacts((data as Contact[]) ?? []);
  }

  useEffect(() => {
    fetchBookings();
    fetchContacts();
    // Default filter is "today", set via initial state
  }, []);

  const programTypes = Array.from(
    new Set(bookings.map((b) => b.booking_type).filter(Boolean) as string[])
  ).sort();

  const filtered = bookings.filter((b) => {
    const d = b.date ?? "";
    const matchDate =
      (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    const matchType = typeFilter === "all" || b.booking_type === typeFilter;
    const matchContact =
      contactFilter === "all" || b.contact_id === contactFilter;
    return matchDate && matchType && matchContact;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">
            Event bookings. Filter by date, program type, and contact.
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
              <Label>Booking type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {programTypes.map((t) => (
                    <SelectItem key={t} value={t!}>
                      {t}
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
                  <SelectItem value="all">All</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-t pt-4">
            <Button 
              variant={activeFilter === "today" ? "default" : "outline"} 
              size="sm"
              onClick={() => applyQuickFilter("today")}
            >
              Today
            </Button>
            <Button 
              variant={activeFilter === "week" ? "default" : "outline"} 
              size="sm"
              onClick={() => applyQuickFilter("week")}
            >
              This Week
            </Button>
            <Button 
              variant={activeFilter === "month" ? "default" : "outline"} 
              size="sm"
              onClick={() => applyQuickFilter("month")}
            >
              This Month
            </Button>
            <Button 
              variant={activeFilter === "all" && !dateFrom && !dateTo ? "default" : "outline"} 
              size="sm"
              onClick={() => applyQuickFilter("all")}
            >
              Clear Dates
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Timeslot</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Kids</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.date ?? "—"}</TableCell>
                    <TableCell>{b.booking_type ?? "—"}</TableCell>
                    <TableCell>{b.timeslot ?? "—"}</TableCell>
                    <TableCell>{b.program_name ?? "—"}</TableCell>
                    <TableCell>
                      {b.contacts?.name ?? (b.contact_id ? "—" : "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {b.kids_count ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">
              No bookings match your filters.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
