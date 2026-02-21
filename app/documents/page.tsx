"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase, BUCKET_DOCUMENTS } from "@/lib/supabase";
import type { Contact, Document } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

const DOC_TYPES = ["waiver", "medical_form", "other"] as const;

export default function DocumentsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<string>("waiver");
  const [contactSearch, setContactSearch] = useState<string>("");
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [viewUrl, setViewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email")
      .order("name", { nullsFirst: false });
    const list = (data as Contact[]) ?? [];
    setContacts(list);
    setSelectedId((prev) => prev || (list[0]?.id ?? ""));
  }, []);

  const fetchDocs = useCallback(async () => {
    if (!selectedId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("contact_id", selectedId)
      .order("uploaded_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("Error listing documents:", error);
      setDocs([]);
      return;
    }
    setDocs((data as Document[]) ?? []);
  }, [selectedId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const searchLower = contactSearch.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(searchLower) || 
           (c.email ?? "").toLowerCase().includes(searchLower);
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    const path = `${selectedId}/${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_DOCUMENTS)
      .upload(path, file, { upsert: true });
    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      alert("Upload failed. Check console.");
      setUploading(false);
      e.target.value = "";
      return;
    }
    const { error: insertErr } = await supabase.from("documents").insert({
      contact_id: selectedId,
      name: file.name,
      url: path,
      type: uploadType || "waiver",
    });
    setUploading(false);
    e.target.value = "";
    if (insertErr) {
      console.error("Error saving document record:", insertErr);
      return;
    }
    fetchDocs();
  }

  async function handleView(doc: Document) {
    const path = doc.url;
    if (!path) return;
    setViewingDoc(doc);
    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTS)
      .createSignedUrl(path, 60);
    if (error) {
      console.error("View error:", error);
      setViewingDoc(null);
      return;
    }
    if (data?.signedUrl) {
      setViewUrl(data.signedUrl);
    }
  }

  async function handleDownload(doc: Document) {
    const path = doc.url;
    if (!path) return;
    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTS)
      .createSignedUrl(path, 60);
    if (error) {
      console.error("Download error:", error);
      return;
    }
    if (data?.signedUrl) {
      // Force download by fetching and creating blob
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name ?? "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  }

  const selectedContact = contacts.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          Upload PDFs (waivers, medical forms) per contact. List and download stored documents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents by contact</CardTitle>
          <CardDescription>Choose a contact to view or upload documents.</CardDescription>
          <div className="w-full sm:max-w-xs pt-2">
            <Label>Contact</Label>
            <Select value={selectedId || undefined} onValueChange={setSelectedId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select contact" />
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
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedId && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                />
                <div className="sm:w-[180px]">
                  <Label>Document type</Label>
                  <Select value={uploadType} onValueChange={setUploadType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading…" : "Upload PDF"}
                </Button>
              </div>
              {loading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : docs.length === 0 ? (
                <p className="text-muted-foreground">
                  No documents for {selectedContact?.name ?? "this contact"}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border px-3 py-2 gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium break-all">{d.name ?? "—"}</span>
                        {d.type && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {d.type}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleView(d)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleDownload(d)}
                        >
                          Download
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {!selectedId && contacts.length === 0 && (
            <p className="text-muted-foreground">No contacts. Add contacts first.</p>
          )}
        </CardContent>
      </Card>

      {/* Document View Dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && (setViewingDoc(null), setViewUrl(""))}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{viewingDoc?.name ?? "Document"}</DialogTitle>
            <DialogDescription>
              {selectedContact?.name ?? "Contact"} - {viewingDoc?.type ?? "Document"}
            </DialogDescription>
          </DialogHeader>
          {viewUrl && (
            <div className="flex-1 overflow-hidden">
              <iframe
                src={viewUrl}
                className="w-full h-[calc(90vh-120px)] border-0"
                title={viewingDoc?.name ?? "Document"}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
