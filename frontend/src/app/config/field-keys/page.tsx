"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useScopedFieldKeys, scopedCreateUrl } from "@/lib/hooks/use-admin";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { FieldKey } from "@/lib/types";

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface FieldKeyFormData {
  name: string;
  display_name: string;
  data_type: string;
  date_format: string;
  decimal_places: string; // kept as string for controlled input
}

const EMPTY_FORM: FieldKeyFormData = {
  name: "",
  display_name: "",
  data_type: "text",
  date_format: "",
  decimal_places: "",
};

const DATA_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
];

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------
function FieldKeysPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const { data: fieldKeys, isLoading, mutate } = useScopedFieldKeys(scope);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<FieldKey | null>(null);
  const [form, setForm] = useState<FieldKeyFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<FieldKey | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingKey(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(fk: FieldKey) {
    setEditingKey(fk);
    setForm({
      name: fk.name,
      display_name: fk.display_name,
      data_type: fk.data_type,
      date_format: fk.date_format ?? "",
      decimal_places: fk.decimal_places != null ? String(fk.decimal_places) : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        display_name: form.display_name,
        data_type: form.data_type,
        date_format: form.date_format || null,
        decimal_places: form.decimal_places === "" ? null : Number(form.decimal_places),
      };
      if (editingKey) {
        await apiPatch(`/api/admin/field-keys/${editingKey.id}`, payload);
      } else {
        await apiPost(scopedCreateUrl(scope, "field-keys"), payload);
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
    await apiDelete(`/api/admin/field-keys/${deleteTarget.id}`);
    await mutate();
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ScopeSelector />
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-3 pt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Field Keys</h1>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add Field Key
        </Button>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format / Precision</TableHead>
                <TableHead>References</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!fieldKeys || fieldKeys.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No field keys configured.
                  </TableCell>
                </TableRow>
              )}
              {fieldKeys?.map((fk) => (
                <TableRow key={fk.id}>
                  <TableCell className="font-mono text-sm">{fk.name}</TableCell>
                  <TableCell>{fk.display_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{fk.data_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fk.data_type === "date" && fk.date_format
                      ? fk.date_format
                      : fk.data_type === "number" && fk.decimal_places != null
                        ? `${fk.decimal_places} decimal${fk.decimal_places !== 1 ? "s" : ""}`
                        : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {fk.column_refs.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {fk.column_refs.length} col{fk.column_refs.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {fk.placeholder_refs.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {fk.placeholder_refs.length} placeholder{fk.placeholder_refs.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {fk.column_refs.length === 0 && fk.placeholder_refs.length === 0 && (
                        <span className="text-xs text-muted-foreground">none</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(fk)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setDeleteTarget(fk);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
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
              {editingKey ? "Edit Field Key" : "Add Field Key"}
            </DialogTitle>
            <DialogDescription>
              {editingKey
                ? "Update field key properties."
                : "Define a new field key for data mapping."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="fk-name">Name</Label>
                <Input
                  id="fk-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. sample_date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fk-display">Display Name</Label>
                <Input
                  id="fk-display"
                  value={form.display_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder="e.g. Sample Date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fk-type">Data Type</Label>
              <Select
                value={form.data_type}
                onValueChange={(val) => setForm((prev) => ({ ...prev, data_type: val ?? "text" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.data_type === "date" && (
              <div className="space-y-1.5">
                <Label htmlFor="fk-date-format">Date Format</Label>
                <Input
                  id="fk-date-format"
                  value={form.date_format}
                  onChange={(e) => setForm((prev) => ({ ...prev, date_format: e.target.value }))}
                  placeholder="e.g. MM/dd/yyyy"
                />
              </div>
            )}

            {form.data_type === "number" && (
              <div className="space-y-1.5">
                <Label htmlFor="fk-decimals">Decimal Places</Label>
                <Input
                  id="fk-decimals"
                  type="number"
                  min={0}
                  value={form.decimal_places}
                  onChange={(e) => setForm((prev) => ({ ...prev, decimal_places: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.display_name}>
              {saving ? "Saving..." : editingKey ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field Key</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.display_name}</strong>. Any column or
              placeholder mappings using this key will be unlinked. This action
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function FieldKeysPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <FieldKeysPageInner />
    </Suspense>
  );
}
