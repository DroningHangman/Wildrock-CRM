"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contact } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Edit state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  // Add state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newContactTypes, setNewContactTypes] = useState<string[]>([]);
  const [newContactTypeInput, setNewContactTypeInput] = useState("");

  async function fetchContacts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("name", { nullsFirst: false });
    if (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
    } else {
      setContacts((data as Contact[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchContacts();
  }, []);

  const contactTypeOptions = Array.from(
    new Set(
      contacts.flatMap((c) => c.contact_types ?? []).filter(Boolean)
    )
  ).sort();

  const filtered = contacts.filter((c) => {
    const matchSearch =
      !search ||
      (c.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.organization ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType =
      typeFilter === "all" ||
      (c.contact_types ?? []).includes(typeFilter);
    return matchSearch && matchType;
  });

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setEditNotes(contact.notes ?? "");
    setEditTags(contact.tags ?? []);
  }

  async function saveContactEdits() {
    if (!editingContact) return;
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({ notes: editNotes, tags: editTags })
      .eq("id", editingContact.id);
    setSaving(false);
    if (error) {
      console.error("Error updating contact:", error);
      return;
    }
    setEditingContact(null);
    fetchContacts();
  }

  async function addContact() {
    if (!newName.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({
      name: newName,
      email: newEmail || null,
      phone: newPhone || null,
      organization: newOrg || null,
      contact_types: newContactTypes.length ? newContactTypes : null,
      tags: [],
      notes: ""
    });
    setSaving(false);
    if (error) {
      console.error("Error adding contact:", error);
      alert("Failed to add contact");
      return;
    }
    setIsAdding(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewOrg("");
    setNewContactTypes([]);
    fetchContacts();
  }

  function addTagToEdit() {
    const t = newTagInput.trim();
    if (t && !editTags.includes(t)) {
      setEditTags([...editTags, t]);
      setNewTagInput("");
    }
  }

  function removeTagFromEdit(tag: string) {
    setEditTags(editTags.filter((x) => x !== tag));
  }

  function addContactType() {
    const t = newContactTypeInput.trim().toLowerCase();
    if (t && !newContactTypes.includes(t)) {
      setNewContactTypes([...newContactTypes, t]);
      setNewContactTypeInput("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Search and filter contacts. Click a row to edit tags and notes.
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)}>Add Contact</Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name, email, or organization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-[180px]">
              <Label>Contact type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  {contactTypeOptions
                    .filter((t) => !["parent", "teacher", "school"].includes(t))
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Types</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEdit(c)}
                  >
                    <TableCell className="font-medium">
                      {c.name ?? "—"}
                    </TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.contact_types ?? []).map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                        {!(c.contact_types ?? []).length && "—"}
                      </div>
                    </TableCell>
                    <TableCell>{c.organization ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                        {!(c.tags ?? []).length && "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">
              No contacts match your filters.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add new contact</DialogTitle>
            <DialogDescription>
              Create a new contact in the CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newName">Name *</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPhone">Phone</Label>
              <Input
                id="newPhone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newOrg">Organization</Label>
              <Input
                id="newOrg"
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                placeholder="School or Company"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Types</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newContactTypes.map((t) => (
                  <Badge 
                    key={t} 
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setNewContactTypes(newContactTypes.filter(x => x !== t))}
                  >
                    {t} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. parent, teacher"
                  value={newContactTypeInput}
                  onChange={(e) => setNewContactTypeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addContactType())}
                />
                <Button type="button" variant="outline" size="sm" onClick={addContactType}>
                  Add
                </Button>
              </div>
              <div className="flex gap-2 mt-1">
                {["parent", "teacher", "school"].map(t => (
                  <Button 
                    key={t}
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs px-2"
                    onClick={() => !newContactTypes.includes(t) && setNewContactTypes([...newContactTypes, t])}
                  >
                    + {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button onClick={addContact} disabled={saving}>
              {saving ? "Adding…" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(o) => !o && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
            <DialogDescription>
              {editingContact?.name ?? "Contact"} — update tags and internal notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {editTags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTagFromEdit(t)}
                  >
                    {t} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTagToEdit())}
                />
                <Button type="button" variant="outline" onClick={addTagToEdit}>
                  Add
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Internal notes</Label>
              <Textarea
                id="notes"
                placeholder="Internal notes..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)}>
              Cancel
            </Button>
            <Button onClick={saveContactEdits} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
