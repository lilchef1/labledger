"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useScopedCustomBlocks, scopedCreateUrl } from "@/lib/hooks/use-admin";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { CustomBlock } from "@/lib/types";

function CustomBlocksPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const { data: items, mutate } = useScopedCustomBlocks(scope);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CustomBlock | null>(null);

  // Form state
  const [blockKey, setBlockKey] = useState("");
  const [fieldsJson, setFieldsJson] = useState("");
  const [jsonError, setJsonError] = useState("");

  function resetForm() {
    setBlockKey("");
    setFieldsJson("");
    setJsonError("");
  }

  function openEdit(item: CustomBlock) {
    setBlockKey(item.block_key);
    setFieldsJson(JSON.stringify(item.fields_json, null, 2));
    setJsonError("");
    setEditing(item);
  }

  function parseJson(): Record<string, unknown>[] | null {
    try {
      const parsed = JSON.parse(fieldsJson);
      if (!Array.isArray(parsed)) {
        setJsonError("Fields JSON must be an array.");
        return null;
      }
      setJsonError("");
      return parsed;
    } catch {
      setJsonError("Invalid JSON.");
      return null;
    }
  }

  async function handleAdd() {
    const parsed = parseJson();
    if (!parsed) return;
    await apiPost(scopedCreateUrl(scope, "custom-blocks"), {
      block_key: blockKey,
      fields_json: parsed,
    });
    resetForm();
    setAdding(false);
    mutate();
  }

  async function handleEdit() {
    if (!editing) return;
    const parsed = parseJson();
    if (!parsed) return;
    await apiPatch(`/api/admin/custom-blocks/${editing.id}`, {
      block_key: blockKey,
      fields_json: parsed,
    });
    resetForm();
    setEditing(null);
    mutate();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/admin/custom-blocks/${id}`);
    mutate();
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Custom Blocks</h1>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" /> Add Block
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Block</DialogTitle>
              <DialogDescription>
                Define a custom data block with its field layout.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-block-key">Block Key</Label>
                <Input
                  id="add-block-key"
                  value={blockKey}
                  onChange={(e) => setBlockKey(e.target.value)}
                  placeholder="e.g. physical_properties"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-fields-json">Fields (JSON array)</Label>
                <Textarea
                  id="add-fields-json"
                  value={fieldsJson}
                  onChange={(e) => {
                    setFieldsJson(e.target.value);
                    setJsonError("");
                  }}
                  placeholder='[{"key": "color", "label": "Color"}]'
                  className="font-mono text-xs"
                  rows={6}
                />
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleAdd} disabled={!blockKey || !fieldsJson}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
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
            <DialogTitle>Edit Custom Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-block-key">Block Key</Label>
              <Input
                id="edit-block-key"
                value={blockKey}
                onChange={(e) => setBlockKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fields-json">Fields (JSON array)</Label>
              <Textarea
                id="edit-fields-json"
                value={fieldsJson}
                onChange={(e) => {
                  setFieldsJson(e.target.value);
                  setJsonError("");
                }}
                className="font-mono text-xs"
                rows={8}
              />
              {jsonError && (
                <p className="text-sm text-destructive">{jsonError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleEdit} disabled={!blockKey || !fieldsJson}>
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
                <TableHead>Block Key</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No custom blocks configured.
                  </TableCell>
                </TableRow>
              )}
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.block_key}</TableCell>
                  <TableCell>
                    {Array.isArray(item.fields_json)
                      ? `${item.fields_json.length} field${item.fields_json.length !== 1 ? "s" : ""}`
                      : "—"}
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
                            <DialogTitle>Delete Custom Block</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete &quot;{item.block_key}&quot;?
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

export default function CustomBlocksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CustomBlocksPageInner />
    </Suspense>
  );
}
