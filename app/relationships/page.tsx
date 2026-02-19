"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Contact, Entity, RelationshipType, ContactEntityRole } from "@/types";
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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  household: "Household",
  school: "School",
  organization: "Organization",
};

export default function RelationshipsPage() {
  // Entity list
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Create entity
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("household");
  const [newDescription, setNewDescription] = useState("");

  // Entity detail
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entityMembers, setEntityMembers] = useState<ContactEntityRole[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);

  // Edit entity
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Add member
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customRoleName, setCustomRoleName] = useState("");

  const [saving, setSaving] = useState(false);

  /* ── Fetch helpers ── */

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entities")
      .select("*, contact_entity_roles(count)")
      .order("name");
    if (error) {
      console.error("Error fetching entities:", error);
      setEntities([]);
    } else {
      setEntities((data as Entity[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const fetchEntityMembers = useCallback(async (entityId: string) => {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from("contact_entity_roles")
      .select("*, contacts(id, name, email)")
      .eq("entity_id", entityId)
      .order("created_at");
    if (error) {
      console.error("Error fetching members:", error);
      setEntityMembers([]);
    } else {
      setEntityMembers((data as ContactEntityRole[]) ?? []);
    }
    setLoadingMembers(false);
  }, []);

  const fetchRelationshipTypes = useCallback(async (entityType: string) => {
    const { data } = await supabase
      .from("relationship_types")
      .select("*")
      .eq("entity_type", entityType)
      .order("is_default", { ascending: false })
      .order("name");
    const types = (data as RelationshipType[]) ?? [];
    setRelationshipTypes(types);
    const defaultType = types.find((t) => t.is_default);
    if (defaultType) setSelectedRole(defaultType.name);
  }, []);

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("name", { nullsFirst: false });
    setAllContacts((data as Contact[]) ?? []);
  }, []);

  /* ── Entity CRUD ── */

  const openEntityDetail = (entity: Entity) => {
    setSelectedEntity(entity);
    setEditName(entity.name);
    setEditDescription(entity.description ?? "");
    setSelectedContactId("");
    setContactSearch("");
    setIsCustomRole(false);
    setCustomRoleName("");
    fetchEntityMembers(entity.id);
    fetchRelationshipTypes(entity.entity_type);
    fetchContacts();
  };

  async function createEntity() {
    if (!newName.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("entities").insert({
      name: newName,
      entity_type: newType,
      description: newDescription || null,
    });
    setSaving(false);
    if (error) {
      alert("Failed to create entity");
      return;
    }
    setIsCreating(false);
    setNewName("");
    setNewType("household");
    setNewDescription("");
    fetchEntities();
  }

  async function saveEntityEdits() {
    if (!selectedEntity) return;
    if (!editName.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("entities")
      .update({
        name: editName,
        description: editDescription || null,
      })
      .eq("id", selectedEntity.id);
    setSaving(false);
    if (error) {
      alert("Failed to update entity");
      return;
    }
    setSelectedEntity(null);
    fetchEntities();
  }

  async function deleteEntity() {
    if (!selectedEntity) return;
    if (
      !confirm(
        `Delete "${selectedEntity.name}"? This will remove all member associations.`
      )
    )
      return;
    setSaving(true);
    const { error } = await supabase
      .from("entities")
      .delete()
      .eq("id", selectedEntity.id);
    setSaving(false);
    if (error) {
      alert("Failed to delete entity");
      return;
    }
    setSelectedEntity(null);
    fetchEntities();
  }

  /* ── Member management ── */

  async function addMember() {
    if (!selectedEntity || !selectedContactId) {
      alert("Please select a contact");
      return;
    }
    const role = isCustomRole ? customRoleName.trim() : selectedRole;
    if (!role) {
      alert("Please select or enter a role");
      return;
    }

    if (isCustomRole && customRoleName.trim()) {
      await supabase
        .from("relationship_types")
        .upsert(
          {
            entity_type: selectedEntity.entity_type,
            name: customRoleName.trim(),
            is_default: false,
          },
          { onConflict: "entity_type,name" }
        );
    }

    setSaving(true);
    const { error } = await supabase.from("contact_entity_roles").insert({
      contact_id: selectedContactId,
      entity_id: selectedEntity.id,
      role,
    });
    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        alert("This contact already has this role in this entity");
      } else {
        alert("Failed to add member");
      }
      return;
    }

    setSelectedContactId("");
    setContactSearch("");
    setIsCustomRole(false);
    setCustomRoleName("");
    fetchEntityMembers(selectedEntity.id);
    fetchRelationshipTypes(selectedEntity.entity_type);
    fetchEntities();
  }

  async function removeMember(roleId: string) {
    if (!selectedEntity) return;
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase
      .from("contact_entity_roles")
      .delete()
      .eq("id", roleId);
    if (error) {
      alert("Failed to remove member");
      return;
    }
    fetchEntityMembers(selectedEntity.id);
    fetchEntities();
  }

  /* ── Helpers ── */

  const getMemberCount = (entity: Entity) => {
    const roles = entity.contact_entity_roles;
    if (!roles || roles.length === 0) return 0;
    return roles[0].count;
  };

  const filtered = entities.filter((e) => {
    const matchSearch =
      !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.entity_type === typeFilter;
    return matchSearch && matchType;
  });

  const filteredContacts = allContacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Relationships</h1>
          <p className="text-muted-foreground">
            Manage households, schools, and organizations.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>Add Entity</Button>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-[180px]">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="household">Household</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEntityDetail(e)}
                  >
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ENTITY_TYPE_LABELS[e.entity_type] ?? e.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getMemberCount(e)} member
                      {getMemberCount(e) !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      {entities.length === 0
                        ? "No entities yet. Create one to get started."
                        : "No results match your filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Create Entity Dialog ── */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create new entity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. The Smith Household"
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="household">Household</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={createEntity} disabled={saving}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Entity Detail Dialog ── */}
      <Dialog
        open={!!selectedEntity}
        onOpenChange={(o) => !o && setSelectedEntity(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="p-6 pb-0 pr-12">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              {selectedEntity?.name}
              <Badge variant="secondary">
                {ENTITY_TYPE_LABELS[selectedEntity?.entity_type ?? ""] ??
                  selectedEntity?.entity_type}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Manage entity details and members
            </DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Entity info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Members
              </h3>

              {loadingMembers ? (
                <p className="text-muted-foreground">Loading members…</p>
              ) : entityMembers.length === 0 ? (
                <p className="text-muted-foreground italic">
                  No members yet. Add one below.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entityMembers.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {m.contacts?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {m.created_at
                            ? new Date(m.created_at).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeMember(m.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Add member */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Add member</p>
                <div className="flex flex-wrap gap-3 items-end">
                  {/* Searchable contact picker */}
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <Label className="text-xs">Contact</Label>
                    <div className="relative">
                      <Input
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          setSelectedContactId("");
                          setShowContactDropdown(true);
                        }}
                        onFocus={() => setShowContactDropdown(true)}
                        placeholder="Search contacts…"
                      />
                      {showContactDropdown && !selectedContactId && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                          {filteredContacts.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No contacts found
                            </div>
                          ) : (
                            filteredContacts.slice(0, 20).map((c) => (
                              <div
                                key={c.id}
                                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedContactId(c.id);
                                  setContactSearch(c.name ?? c.email ?? "");
                                  setShowContactDropdown(false);
                                }}
                              >
                                <span className="font-medium">
                                  {c.name ?? "Unnamed"}
                                </span>
                                {c.email && (
                                  <span className="text-muted-foreground ml-2">
                                    {c.email}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Role picker */}
                  <div className="flex-1 min-w-[180px] space-y-1">
                    <Label className="text-xs">Role</Label>
                    {isCustomRole ? (
                      <div className="flex gap-2">
                        <Input
                          value={customRoleName}
                          onChange={(e) => setCustomRoleName(e.target.value)}
                          placeholder="Enter role name…"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMember();
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsCustomRole(false);
                            setCustomRoleName("");
                            const defaultType = relationshipTypes.find(
                              (t) => t.is_default
                            );
                            setSelectedRole(defaultType?.name ?? "");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={selectedRole}
                        onValueChange={(val) => {
                          if (val === "__custom__") {
                            setIsCustomRole(true);
                            setSelectedRole("");
                          } else {
                            setSelectedRole(val);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role…" />
                        </SelectTrigger>
                        <SelectContent>
                          {relationshipTypes.map((rt) => (
                            <SelectItem key={rt.id} value={rt.name}>
                              {rt.name}
                              {rt.is_default ? " (default)" : ""}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">
                            + Add new role…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Button onClick={addMember} disabled={saving} size="sm">
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t flex-row justify-between items-center">
            <Button
              variant="destructive"
              onClick={deleteEntity}
              disabled={saving}
            >
              Delete Entity
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedEntity(null)}
              >
                Close
              </Button>
              <Button onClick={saveEntityEdits} disabled={saving}>
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
