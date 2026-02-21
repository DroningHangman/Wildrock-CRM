"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Membership, Contact } from "@/types";
import Papa from "papaparse";
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

  // Edit state
  const [editingMembership, setEditingMembership] = useState<MembershipRow | null>(null);
  const [editType, setEditType] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Export state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({
    contact_name: true,
    membership_type: true,
    start_date: true,
    end_date: true,
    code: true,
    status: true,
  });

  // Available export columns
  const exportColumnOptions = [
    { key: "contact_name", label: "Contact Name" },
    { key: "membership_type", label: "Membership Type" },
    { key: "start_date", label: "Start Date" },
    { key: "end_date", label: "End Date" },
    { key: "code", label: "Code" },
    { key: "status", label: "Status" },
  ];

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

  function openEdit(membership: MembershipRow) {
    setEditingMembership(membership);
    setEditType(membership.membership_type ?? "");
    setEditStartDate(membership.start_date ?? "");
    setEditEndDate(membership.end_date ?? "");
    setEditCode(membership.code ?? "");
    setEditStatus(membership.status ?? "active");
  }

  async function saveMembershipEdits() {
    if (!editingMembership) return;
    setSaving(true);
    const { error } = await supabase
      .from("memberships")
      .update({
        membership_type: editType,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        code: editCode || null,
        status: editStatus
      })
      .eq("id", editingMembership.id);
    setSaving(false);
    if (error) {
      console.error("Error updating membership:", error);
      alert("Failed to update membership");
      return;
    }
    setEditingMembership(null);
    fetchMemberships();
  }

  async function deleteMembership() {
    if (!editingMembership) return;
    if (!confirm("Are you sure you want to delete this membership?")) return;
    setSaving(true);
    const { error } = await supabase.from("memberships").delete().eq("id", editingMembership.id);
    setSaving(false);
    if (error) {
      console.error("Error deleting membership:", error);
      alert("Failed to delete membership");
      return;
    }
    setEditingMembership(null);
    fetchMemberships();
  }

  const handleExportMemberships = () => {
    // Get selected columns
    const selectedColumns = exportColumnOptions.filter(col => exportColumns[col.key]);
    
    if (selectedColumns.length === 0) {
      alert("Please select at least one column to export.");
      return;
    }

    // Prepare data for export
    const exportData = filtered.map(membership => {
      const row: Record<string, string> = {};
      
      selectedColumns.forEach(col => {
        if (col.key === "contact_name") {
          row[col.label] = membership.contacts?.name ?? "";
        } else {
          const value = membership[col.key as keyof Membership];
          row[col.label] = value != null ? String(value) : "";
        }
      });
      
      return row;
    });

    // Generate CSV
    const csv = Papa.unparse(exportData);
    
    // Create download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `memberships_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsExportOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Memberships</h1>
          <p className="text-muted-foreground text-sm">
            Manage member programs and status.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsExportOpen(true)}>Export Data</Button>
          <Button className="flex-1 sm:flex-none" onClick={() => setIsAdding(true)}>Add Membership</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
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
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
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
                      <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(m)}>
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
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border p-4 space-y-2 cursor-pointer hover:bg-muted/50 active:bg-muted"
                    onClick={() => openEdit(m)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{m.contacts?.name ?? "—"}</p>
                        <p className="text-sm text-muted-foreground">{m.membership_type ?? "—"}</p>
                      </div>
                      <Badge variant={m.status === "active" ? "default" : "secondary"}>
                        {m.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Start</p>
                        <p>{m.start_date ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">End</p>
                        <p>{m.end_date ?? "—"}</p>
                      </div>
                    </div>
                    {m.code && (
                      <p className="text-xs text-muted-foreground">
                        Code: <code>{m.code}</code>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
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

      {/* Edit Membership Dialog */}
      <Dialog open={!!editingMembership} onOpenChange={(o) => !o && setEditingMembership(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit membership</DialogTitle>
            <DialogDescription>
              Update details for {editingMembership?.contacts?.name}&apos;s membership.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editType">Membership Type *</Label>
              <Input
                id="editType"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStart">Start Date</Label>
                <Input
                  id="editStart"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEnd">End Date</Label>
                <Input
                  id="editEnd"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCode">Membership Code</Label>
              <Input
                id="editCode"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
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
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" onClick={deleteMembership} disabled={saving} className="sm:mr-auto">
              Delete
            </Button>
            <Button variant="outline" onClick={() => setEditingMembership(null)}>
              Cancel
            </Button>
            <Button onClick={saveMembershipEdits} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Memberships</DialogTitle>
            <DialogDescription>
              Select columns to export. Current filters will be applied ({filtered.length} memberships).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Columns</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-3">
                {exportColumnOptions.map((col) => (
                  <div key={col.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`export-${col.key}`}
                      checked={exportColumns[col.key]}
                      onCheckedChange={(checked) =>
                        setExportColumns({ ...exportColumns, [col.key]: checked === true })
                      }
                    />
                    <Label htmlFor={`export-${col.key}`} className="font-normal cursor-pointer">
                      {col.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Active filters:</p>
              <ul className="list-disc list-inside mt-1">
                {search && <li>Search: &quot;{search}&quot;</li>}
                {statusFilter !== "all" && <li>Status: {statusFilter}</li>}
                {!search && statusFilter === "all" && <li>No filters applied</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExportMemberships}>Export CSV</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
