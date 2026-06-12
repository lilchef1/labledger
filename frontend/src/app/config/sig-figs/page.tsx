"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { SimpleField } from "@/lib/types";

function SigFigsContent() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";

  const baseUrl =
    scope === "global"
      ? "/api/admin/global/simple-fields"
      : `/api/admin/disciplines/${scope}/simple-fields`;

  const { data: items, mutate } = useSWR<SimpleField[]>(baseUrl, apiGet);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SimpleField | null>(null);

  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [unit, setUnit] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState<number | null>(null);

  function resetForm() {
    setKey("");
    setDisplayName("");
    setUnit("");
    setDecimalPlaces(null);
  }

  function openEdit(item: SimpleField) {
    setKey(item.key);
    setDisplayName(item.display_name);
    setUnit(item.unit);
    setDecimalPlaces(item.decimal_places);
    setEditing(item);
  }

  async function handleAdd() {
    await apiPost(baseUrl, {
      key,
      display_name: displayName,
      unit,
      decimal_places: decimalPlaces,
    });
    resetForm();
    setAdding(false);
    mutate();
  }

  async function handleEdit() {
    if (!editing) return;
    await apiPatch(`/api/admin/simple-fields/${editing.id}`, {
      key,
      display_name: displayName,
      unit,
      decimal_places: decimalPlaces,
    });
    resetForm();
    setEditing(null);
    mutate();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/admin/simple-fields/${id}`);
    mutate();
  }

  async function handleInlineUpdate(item: SimpleField, field: string, value: string | number | null) {
    await apiPatch(`/api/admin/simple-fields/${item.id}`, { [field]: value });
    mutate();
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sig Figs</h1>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" /> Add Field
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sig Fig</DialogTitle>
              <DialogDescription>
                Configure decimal places and units for a report field.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-key">Key</Label>
                <Input
                  id="add-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="e.g. sample_depth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-display-name">Display Name</Label>
                <Input
                  id="add-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sample Depth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-unit">Unit</Label>
                <Input
                  id="add-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. ppm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-dp">Decimal Places</Label>
                <Input
                  id="add-dp"
                  type="number"
                  min={0}
                  max={10}
                  value={decimalPlaces ?? ""}
                  onChange={(e) =>
                    setDecimalPlaces(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleAdd} disabled={!key || !displayName}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sig Fig</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key">Key</Label>
              <Input
                id="edit-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-display-name">Display Name</Label>
              <Input
                id="edit-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unit</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dp">Decimal Places</Label>
              <Input
                id="edit-dp"
                type="number"
                min={0}
                max={10}
                value={decimalPlaces ?? ""}
                onChange={(e) =>
                  setDecimalPlaces(e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleEdit} disabled={!key || !displayName}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Decimal Places</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No sig figs configured.
                  </TableCell>
                </TableRow>
              )}
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.key}</TableCell>
                  <TableCell>{item.display_name}</TableCell>
                  <TableCell>
                    <InlineEdit
                      value={item.unit}
                      onSave={(v) => handleInlineUpdate(item, "unit", v)}
                      placeholder="--"
                    />
                  </TableCell>
                  <TableCell>
                    <InlineNumberEdit
                      value={item.decimal_places}
                      onSave={(v) => handleInlineUpdate(item, "decimal_places", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <Trash2 className="size-4 text-destructive" />
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Sig Fig</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete &quot;{item.display_name}&quot;?
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose render={<Button variant="outline" />}>
                              Cancel
                            </DialogClose>
                            <DialogClose
                              render={<Button variant="destructive" />}
                              onClick={() => handleDelete(item.id)}
                            >
                              Delete
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SigFigsPage() {
  return (
    <Suspense>
      <SigFigsContent />
    </Suspense>
  );
}

function InlineEdit({
  value,
  onSave,
  placeholder = "",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:underline"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 w-24"
    />
  );
}

function InlineNumberEdit({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");

  function commit() {
    setEditing(false);
    const parsed = draft === "" ? null : Number(draft);
    if (parsed !== value) onSave(parsed);
  }

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:underline"
        onClick={() => {
          setDraft(value?.toString() ?? "");
          setEditing(true);
        }}
      >
        {value != null ? value : <span className="text-muted-foreground">--</span>}
      </span>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      min={0}
      max={10}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 w-16"
    />
  );
}
