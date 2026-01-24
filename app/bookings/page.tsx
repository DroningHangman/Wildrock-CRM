"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Booking, Contact } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [contactFilter, setContactFilter] = useState<string>("all");

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
      <div>
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">
          Event bookings. Filter by date, program type, and contact.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <Label htmlFor="dateFrom">Date from</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-[160px]"
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Date to</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
