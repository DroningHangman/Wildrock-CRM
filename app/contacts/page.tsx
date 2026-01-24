"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, BUCKET_DOCUMENTS } from "@/lib/supabase";
import type { Contact, Booking, Membership, Document } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type ViewTab = "profile" | "bookings" | "memberships" | "documents";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // 360 View State
  const [activeTab, setActiveTab] = useState<ViewTab>("profile");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactBookings, setContactBookings] = useState<Booking[]>([]);
  const [contactMemberships, setContactMemberships] = useState<Membership[]>([]);
  const [contactDocuments, setContactDocuments] = useState<Document[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editContactTypes, setEditContactTypes] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editMarketingConsent, setEditMarketingConsent] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [newContactTypeInput, setNewContactTypeInput] = useState("");

  // Add state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newContactTypes, setNewContactTypes] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newMarketingConsent, setNewMarketingConsent] = useState<boolean>(false);
  
  // Constrained tag options
  const allowedTags = ["Parent", "Teacher", "Volunteer", "Prospect"];

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

  const fetchRelatedData = useCallback(async (contactId: string) => {
    setLoadingRelated(true);
    
    const [bookingsRes, membershipsRes, docsRes] = await Promise.all([
      supabase.from("bookings").select("*").eq("contact_id", contactId).order("date", { ascending: false }),
      supabase.from("memberships").select("*").eq("contact_id", contactId).order("start_date", { ascending: false }),
      supabase.from("documents").select("*").eq("contact_id", contactId).order("uploaded_at", { ascending: false })
    ]);

    setContactBookings(bookingsRes.data ?? []);
    setContactMemberships(membershipsRes.data ?? []);
    setContactDocuments(docsRes.data ?? []);
    setLoadingRelated(false);
  }, []);

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditName(contact.name ?? "");
    setEditEmail(contact.email ?? "");
    setEditPhone(contact.phone ?? "");
    setEditOrg(contact.organization ?? "");
    setEditContactTypes(contact.contact_types ?? []);
    setEditNotes(contact.notes ?? "");
    setEditTags(contact.tags ?? []);
    setEditMarketingConsent(contact.marketing_consent ?? false);
    setActiveTab("profile");
    fetchRelatedData(contact.id);
  };

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

  async function saveContactEdits() {
    if (!editingContact) return;
    if (!editName.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({ 
        name: editName,
        email: editEmail || null,
        phone: editPhone || null,
        organization: editOrg || null,
        contact_types: editContactTypes.length ? editContactTypes : null,
        notes: editNotes, 
        tags: editTags,
        marketing_consent: editMarketingConsent
      })
      .eq("id", editingContact.id);
    setSaving(false);
    if (error) {
      console.error("Error updating contact:", error);
      alert("Failed to update contact");
      return;
    }
    setEditingContact(null);
    fetchContacts();
  }

  async function deleteContact() {
    if (!editingContact) return;
    if (!confirm(`Are you sure you want to delete ${editingContact.name}? This will also remove all their historical data.`)) return;
    
    setSaving(true);
    const { error } = await supabase.from("contacts").delete().eq("id", editingContact.id);
    setSaving(false);
    
    if (error) {
      alert("Failed to delete contact.");
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
      tags: newTags.length ? newTags : null,
      marketing_consent: newMarketingConsent,
      notes: ""
    });
    setSaving(false);
    if (error) {
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

  const handleDownload = async (doc: Document) => {
    if (!doc.url) return;
    const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTS).createSignedUrl(doc.url, 60);
    if (error) return;
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Search and manage your community.</p>
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
                  {["parent", "teacher", "school"].map(t => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                  {contactTypeOptions
                    .filter((t) => !["parent", "teacher", "school"].includes(t))
                    .map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
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
                  <TableHead>Marketing Consent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEdit(c)}
                  >
                    <TableCell className="font-medium">{c.name ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.contact_types ?? []).map((t) => (
                          <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{c.organization ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).map((t) => (
                          <Badge key={t} variant="outline">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.marketing_consent === true ? (
                        <Badge variant="default" className="bg-green-600">Yes</Badge>
                      ) : c.marketing_consent === false ? (
                        <Badge variant="secondary">No</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add new contact</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-2">
              <Label>Organization</Label>
              <Input value={newOrg} onChange={(e) => setNewOrg(e.target.value)} placeholder="School or Company" />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newTags.map(t => (
                  <Badge key={t} variant="outline" className="cursor-pointer" onClick={() => setNewTags(newTags.filter(x => x !== t))}>
                    {t} ×
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {allowedTags
                  .filter(tag => !newTags.includes(tag))
                  .map(tag => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => setNewTags([...newTags, tag])}
                    >
                      + {tag}
                    </Button>
                  ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="new-marketing-consent" 
                checked={newMarketingConsent}
                onCheckedChange={(checked) => setNewMarketingConsent(checked === true)}
              />
              <Label htmlFor="new-marketing-consent" className="font-normal cursor-pointer">
                Marketing Consent (Email/Newsletter)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={addContact} disabled={saving}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact 360 View Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(o) => !o && setEditingContact(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="p-6 pb-0 flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold">{editingContact?.name}</DialogTitle>
              <DialogDescription>Contact 360 View</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={activeTab === "profile" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("profile")}>Profile</Button>
              <Button variant={activeTab === "bookings" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("bookings")}>Bookings</Button>
              <Button variant={activeTab === "memberships" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("memberships")}>Memberships</Button>
              <Button variant={activeTab === "documents" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("documents")}>Documents</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "profile" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Name *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Organization</Label><Input value={editOrg} onChange={(e) => setEditOrg(e.target.value)} /></div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contact Types</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editContactTypes.map(t => <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => setEditContactTypes(editContactTypes.filter(x => x !== t))}>{t} ×</Badge>)}
                    </div>
                    <Input placeholder="Add type..." value={newContactTypeInput} onChange={(e) => setNewContactTypeInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), editContactTypes.includes(newContactTypeInput.trim()) || (setEditContactTypes([...editContactTypes, newContactTypeInput.trim()]), setNewContactTypeInput("")))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editTags.map(t => <Badge key={t} variant="outline" className="cursor-pointer" onClick={() => setEditTags(editTags.filter(x => x !== t))}>{t} ×</Badge>)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allowedTags
                        .filter(tag => !editTags.includes(tag))
                        .map(tag => (
                          <Button
                            key={tag}
                            variant="outline"
                            size="sm"
                            onClick={() => setEditTags([...editTags, tag])}
                          >
                            + {tag}
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-full space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="marketing-consent" 
                      checked={editMarketingConsent}
                      onCheckedChange={(checked) => setEditMarketingConsent(checked === true)}
                    />
                    <Label htmlFor="marketing-consent" className="font-normal cursor-pointer">
                      Marketing Consent (Email/Newsletter)
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Internal notes</Label>
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="min-h-[100px]" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="space-y-4">
                {loadingRelated ? <p>Loading activity...</p> : contactBookings.length === 0 ? <p className="text-muted-foreground italic">No past bookings found.</p> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Program</TableHead><TableHead>Kids</TableHead><TableHead>Timeslot</TableHead></TableRow></TableHeader>
                    <TableBody>{contactBookings.map(b => (
                      <TableRow key={b.id}><TableCell>{b.date}</TableCell><TableCell>{b.program_name}</TableCell><TableCell>{b.kids_count}</TableCell><TableCell>{b.timeslot}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </div>
            )}

            {activeTab === "memberships" && (
              <div className="space-y-4">
                {loadingRelated ? <p>Loading...</p> : contactMemberships.length === 0 ? <p className="text-muted-foreground italic">No memberships found.</p> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>End Date</TableHead><TableHead>Code</TableHead></TableRow></TableHeader>
                    <TableBody>{contactMemberships.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>{m.membership_type}</TableCell>
                        <TableCell><Badge variant={m.status === 'active' ? 'default' : 'secondary'}>{m.status}</Badge></TableCell>
                        <TableCell>{m.end_date ?? '—'}</TableCell>
                        <TableCell><code>{m.code}</code></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-4">
                {loadingRelated ? <p>Loading...</p> : contactDocuments.length === 0 ? <p className="text-muted-foreground italic">No documents uploaded.</p> : (
                  <div className="grid gap-2">{contactDocuments.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                      <div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground capitalize">{d.type}</p></div>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>View/Download</Button>
                    </div>
                  ))}</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t flex-row justify-between items-center">
            <Button variant="destructive" onClick={deleteContact} disabled={saving}>Delete Contact</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingContact(null)}>Close</Button>
              {activeTab === "profile" && <Button onClick={saveContactEdits} disabled={saving}>Save Changes</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
