"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { scopedCreateUrl } from "@/lib/hooks/use-admin";
import type { RequestCode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Scope-aware URL helper
// ---------------------------------------------------------------------------
function scopedUrl(scope: string): string | null {
  if (!scope) return null;
  if (scope === "global") return "/api/admin/global/request-codes";
  const id = Number(scope);
  if (Number.isNaN(id)) return null;
  return `/api/admin/disciplines/${id}/request-codes`;
}

// ---------------------------------------------------------------------------
// Inner component (needs Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------
function RequestCodesPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const { data: items, mutate } = useSWR<RequestCode[]>(
    scopedUrl(scope),
    apiGet,
  );

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RequestCode | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [sectionKey, setSectionKey] = useState("");

  function resetForm() {
    setCode("");
    setSectionKey("");
  }

  function openEdit(item: RequestCode) {
    setCode(item.code);
    setSectionKey(item.section_key);
    setEditing(item);
  }

  async function handleAdd() {
    await apiPost(scopedCreateUrl(scope, "request-codes"), {
      code,
      section_key: sectionKey,
    });
    resetForm();
    setAdding(false);
    mutate();
  }

  async function handleEdit() {
    if (!editing) return;
    await apiPatch(`/api/admin/request-codes/${editing.id}`, {
      code,
      section_key: sectionKey,
    });
    resetForm();
    setEditing(null);
    mutate();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/admin/request-codes/${id}`);
    mutate();
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Request Codes</h1>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" /> Add Request Code
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Request Code</DialogTitle>
              <DialogDescription>
                Map a request code to a report section.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-code">Code</Label>
                <Input
                  id="add-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. S1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-section-key">Section Key</Label>
                <Input
                  id="add-section-key"
                  value={sectionKey}
                  onChange={(e) => setSectionKey(e.target.value)}
                  placeholder="e.g. soil_analysis"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleAdd} disabled={!code || !sectionKey}>
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
            <DialogTitle>Edit Request Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-section-key">Section Key</Label>
              <Input
                id="edit-section-key"
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleEdit} disabled={!code || !sectionKey}>
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
                <TableHead>Code</TableHead>
                <TableHead>Section Key</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No request codes configured.
                  </TableCell>
                </TableRow>
              )}
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code}</TableCell>
                  <TableCell>{item.section_key}</TableCell>
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
                            <DialogTitle>Delete Request Code</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete &quot;{item.code}&quot;?
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

// ---------------------------------------------------------------------------
// Page (with Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------
export default function RequestCodesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequestCodesPageInner />
    </Suspense>
  );
}
