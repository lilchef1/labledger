"use client";

import { useState } from "react";
import useSWR from "swr";
import { useLabInfo } from "@/lib/hooks/use-admin";
import { apiGet, apiPut, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { ConfigBreadcrumb } from "@/components/config/config-breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import type { LabInfo } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminDiscipline {
  id: number;
  name: string;
  green_bar_title: string;
  spreadsheet_id_prefix: string;
  report_filename_pattern: string;
}

interface DisciplineFormData {
  name: string;
  green_bar_title: string;
}

const EMPTY_FORM: DisciplineFormData = { name: "", green_bar_title: "" };

// ---------------------------------------------------------------------------
// Lab Info Section (collapsible)
// ---------------------------------------------------------------------------

function LabInfoCard() {
  const { data: lab, isLoading, mutate } = useLabInfo();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<LabInfo>>({});
  const [collapsed, setCollapsed] = useState(true);

  function startEditing() {
    if (!lab) return;
    setForm({ name: lab.name, address: lab.address, city: lab.city, state: lab.state, zip: lab.zip, phone: lab.phone, email: lab.email });
    setEditing(true);
    setCollapsed(false);
  }

  async function save() {
    setSaving(true);
    try {
      await apiPut("/api/admin/lab-info", form);
      await mutate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Lab Information</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-36" />
        </CardContent>
      </Card>
    );
  }

  if (!lab) {
    return (
      <Card>
        <CardHeader><CardTitle>Lab Information</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">No lab info configured.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex items-center gap-2 text-left"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          <CardTitle>Lab Information</CardTitle>
        </button>
        <CardAction>
          {!editing && (
            <Button variant="ghost" size="icon-sm" onClick={startEditing}>
              <Pencil />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          {editing ? (
            <div className="space-y-3 max-w-md">
              <div className="space-y-1">
                <Label htmlFor="lab-name">Name</Label>
                <Input id="lab-name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lab-address">Address</Label>
                <Input id="lab-address" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: "0.5rem" }}>
                <div className="space-y-1">
                  <Label htmlFor="lab-city">City</Label>
                  <Input id="lab-city" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lab-state">State</Label>
                  <Input id="lab-state" value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lab-zip">ZIP</Label>
                  <Input id="lab-zip" value={form.zip ?? ""} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div className="space-y-1">
                  <Label htmlFor="lab-phone">Phone</Label>
                  <Input id="lab-phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lab-email">Email</Label>
                  <Input id="lab-email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <dl className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">Name:</span> {lab.name}</div>
              <div><span className="text-muted-foreground">Address:</span> {lab.address}, {lab.city}, {lab.state} {lab.zip}</div>
              <div><span className="text-muted-foreground">Phone:</span> {lab.phone}</div>
              <div><span className="text-muted-foreground">Email:</span> {lab.email}</div>
            </dl>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Disciplines Section
// ---------------------------------------------------------------------------

function DisciplinesSection() {
  const { data: disciplines, isLoading, mutate } = useSWR<AdminDiscipline[]>(
    "/api/admin/disciplines",
    apiGet,
  );

  // Create / Edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDisc, setEditingDisc] = useState<AdminDiscipline | null>(null);
  const [form, setForm] = useState<DisciplineFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<AdminDiscipline | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingDisc(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(disc: AdminDiscipline) {
    setEditingDisc(disc);
    setForm({ name: disc.name, green_bar_title: disc.green_bar_title });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        green_bar_title: form.green_bar_title,
      };
      if (editingDisc) {
        await apiPatch(`/api/admin/disciplines/${editingDisc.id}`, payload);
      } else {
        await apiPost("/api/admin/disciplines", { ...payload, org_id: 1 });
      }
      await mutate();
      setDialogOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await apiDelete(`/api/admin/disciplines/${deleteTarget.id}`);
    await mutate();
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 pt-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Disciplines</h2>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add Discipline
        </Button>
      </div>

      {(!disciplines || disciplines.length === 0) ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No disciplines configured. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {disciplines.map((disc) => (
            <Card key={disc.id}>
              <CardHeader>
                <CardTitle className="text-base">{disc.name}</CardTitle>
                <CardAction>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(disc)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setDeleteTarget(disc);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{disc.green_bar_title}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDisc ? "Edit Discipline" : "Add Discipline"}
            </DialogTitle>
            <DialogDescription>
              {editingDisc
                ? "Update discipline properties."
                : "Create a new discipline for your lab."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="disc-name">Name</Label>
              <Input
                id="disc-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Soil"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disc-title">Report Title</Label>
              <Input
                id="disc-title"
                value={form.green_bar_title}
                onChange={(e) => setForm((prev) => ({ ...prev, green_bar_title: e.target.value }))}
                placeholder="e.g. Soil Analysis"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.green_bar_title}
            >
              {saving ? "Saving..." : editingDisc ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Discipline</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.name}</strong> and all of its associated
              configuration (analytes, field keys, triggers, etc.). This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <ConfigBreadcrumb />
      <h1 className="text-2xl font-semibold">Group Management</h1>
      <LabInfoCard />
      <DisciplinesSection />
    </div>
  );
}
