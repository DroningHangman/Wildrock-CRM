"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmailTemplate } from "@/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    setLoading(true);
    const res = await fetch("/api/email/templates");
    if (res.ok) {
      setTemplates(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await fetch(`/api/email/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create reusable templates with <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> placeholders.
          </p>
        </div>
        <Button asChild>
          <Link href="/emails/templates/new">+ New Template</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No templates yet.</p>
          <Button asChild variant="outline">
            <Link href="/emails/templates/new">Create your first template</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">{t.subject}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {t.variables.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      t.variables.slice(0, 3).map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {"{{"}{v}{"}}"}
                        </Badge>
                      ))
                    )}
                    {t.variables.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{t.variables.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/emails/templates/${t.id}`}>Edit</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(t.id, t.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
