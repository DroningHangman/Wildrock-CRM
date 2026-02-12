"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Document, Page, Text, Image, pdf, StyleSheet } from "@react-pdf/renderer";
import { supabase, BUCKET_DOCUMENTS } from "@/lib/supabase";
import type { Contact } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const WAIVER_TEXT = `I, the undersigned parent or legal guardian, hereby grant permission for my child(ren) to participate in activities at Wildrock. I understand and acknowledge the risks associated with outdoor and recreational activities. I release Wildrock, its staff, and affiliates from any liability for injuries that may occur during participation. I certify that the information provided is accurate and that I have the authority to sign this waiver on behalf of the minor(s) listed.`;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 20, fontWeight: "bold" },
  body: { marginBottom: 20, lineHeight: 1.5 },
  meta: { marginBottom: 20, fontSize: 10, color: "#666" },
  sigLabel: { marginTop: 30, marginBottom: 8, fontSize: 10 },
  sigImage: { width: 250, height: 80 },
});

interface CaptureWaiverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSuccess: () => void;
}

export function CaptureWaiverModal({ open, onOpenChange, contact, onSuccess }: CaptureWaiverModalProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [saving, setSaving] = useState(false);

  const handleClear = () => {
    sigRef.current?.clear();
  };

  const handleSave = async () => {
    if (!contact?.id || !sigRef.current) return;
    if (sigRef.current.isEmpty()) {
      alert("Please sign before saving.");
      return;
    }

    setSaving(true);
    try {
      const dataUrl = sigRef.current.toDataURL("image/png");
      const contactName = contact.name ?? "Unknown";
      const dateStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const WaiverPDF = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.title}>Participant Waiver</Text>
            <Text style={styles.meta}>
              Contact: {contactName} | Date: {dateStr}
            </Text>
            <Text style={styles.body}>{WAIVER_TEXT}</Text>
            <Text style={styles.sigLabel}>Signature:</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={dataUrl} style={styles.sigImage} cache={false} />
          </Page>
        </Document>
      );

      const blob = await pdf(<WaiverPDF />).toBlob();
      const filename = `waiver-${Date.now()}.pdf`;
      const path = `${contact.id}/${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_DOCUMENTS)
        .upload(path, blob, { upsert: true, contentType: "application/pdf" });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        alert("Failed to save waiver. Check console.");
        setSaving(false);
        return;
      }

      const { error: insertErr } = await supabase.from("documents").insert({
        contact_id: contact.id,
        name: filename,
        url: path,
        type: "waiver",
      });

      if (insertErr) {
        console.error("Insert error:", insertErr);
        alert("Failed to save waiver record.");
        setSaving(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
      sigRef.current.clear();
    } catch (err) {
      console.error(err);
      alert("An error occurred. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Capture Waiver</DialogTitle>
          <DialogDescription>
            {contact?.name ?? "Contact"} — Have the parent/guardian sign below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded border bg-muted/30 p-3 text-sm max-h-[120px] overflow-y-auto">
            {WAIVER_TEXT}
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Signature</p>
            <div className="border rounded-lg overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  className: "w-full h-[180px] touch-none",
                  style: { width: "100%", height: 180 },
                }}
                penColor="black"
                backgroundColor="white"
              />
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Waiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
