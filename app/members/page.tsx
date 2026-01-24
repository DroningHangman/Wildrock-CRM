"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Membership, Contact } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MembershipRow extends Membership {
  contacts?: Contact | null;
}

export default function MembersPage() {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Add state
  const [isAdding, setIsAdding] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [newType, setNewType] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newEndDate, setNewEndDate] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  async function fetchMemberships() {
    setLoading(true);
    const { data, error } = await supabase
      .from("memberships")
      .select("*, contacts(*)")
      .order("start_date", { ascending: false });
    if (error) {
      console.error("Error fetching memberships:", error);
      setMemberships([]);
    } else {
      setMemberships((data as MembershipRow[]) ?? []);
    }
    setLoading(false);
  }

  async function fetchContacts() {
    const { data } = await supabase.from("contacts").select("id, name").order("name");
    setContacts((data as Contact[]) ?? []);
  }

  useEffect(() => {
    fetchMemberships();
    fetchContacts();
  }, []);

  const filtered = memberships.filter((m) => {
    const name = m.contacts?.name ?? "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || (m.code ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function addMembership() {
    if (!selectedContactId || !newType) {
      alert("Contact and Type are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("memberships").insert({
      contact_id: selectedContactId,
      membership_type: newType,
      start_date: newStartDate || null,
      end_date: newEndDate || null,
      code: newCode || null,
      status: newStatus
    });
    setSaving(false);
    if (error) {
      console.error("Error adding membership:", error);
      alert("Failed to add membership");
      return;
    }
    setIsAdding(false);
    setSelectedContactId("");
    setNewType("");
    setNewCode("");
    fetchMemberships();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Memberships</h1>
          <p className="text-muted-foreground">
            Manage member programs and status.
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)}>Add Membership</Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-[180px]">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.contacts?.name ?? "—"}
                    </TableCell>
                    <TableCell>{m.membership_type ?? "—"}</TableCell>
                    <TableCell>{m.start_date ?? "—"}</TableCell>
                    <TableCell>{m.end_date ?? "—"}</TableCell>
                    <TableCell><code>{m.code ?? "—"}</code></TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "default" : "secondary"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">
              No memberships match your filters.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Membership Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add membership</DialogTitle>
            <DialogDescription>
              Assign a membership to a contact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contact *</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newType">Membership Type *</Label>
              <Input
                id="newType"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="e.g. Annual, Monthly"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date</Label>
                <Input
                  id="start"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date</Label>
                <Input
                  id="end"
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Membership Code</Label>
              <Input
                id="code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. WILD-123"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button onClick={addMembership} disabled={saving}>
              {saving ? "Adding…" : "Add Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
