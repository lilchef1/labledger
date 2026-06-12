"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useScopedComputedRecs, scopedCreateUrl } from "@/lib/hooks/use-admin";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { ComputedRecommendation } from "@/lib/types";

function ComputationsPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const { data: items, mutate } = useScopedComputedRecs(scope);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ComputedRecommendation | null>(null);

  // Form state
  const [analyteKey, setAnalyteKey] = useState("");
  const [computationType, setComputationType] = useState("");
  const [paramsJson, setParamsJson] = useState("");
  const [jsonError, setJsonError] = useState("");

  function resetForm() {
    setAnalyteKey("");
    setComputationType("");
    setParamsJson("");
    setJsonError("");
  }

  function openEdit(item: ComputedRecommendation) {
    setAnalyteKey(item.analyte_key);
    setComputationType(item.computation_type);
    setParamsJson(JSON.stringify(item.params_json, null, 2));
    setJsonError("");
    setEditing(item);
  }

  function parseJson(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(paramsJson);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        setJsonError("Params must be a JSON object.");
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
    await apiPost(scopedCreateUrl(scope, "computed-recs"), {
      analyte_key: analyteKey,
      computation_type: computationType,
      params_json: parsed,
    });
    resetForm();
    setAdding(false);
    mutate();
  }

  async function handleEdit() {
    if (!editing) return;
    const parsed = parseJson();
    if (!parsed) return;
    await apiPatch(`/api/admin/computed-recs/${editing.id}`, {
      analyte_key: analyteKey,
      computation_type: computationType,
      params_json: parsed,
    });
    resetForm();
    setEditing(null);
    mutate();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/admin/computed-recs/${id}`);
    mutate();
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Computed Fields</h1>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" /> Add Computation
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Computed Recommendation</DialogTitle>
              <DialogDescription>
                Define a computation formula for an analyte.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-analyte-key">Analyte Key</Label>
                <Input
                  id="add-analyte-key"
                  value={analyteKey}
                  onChange={(e) => setAnalyteKey(e.target.value)}
                  placeholder="e.g. nitrogen"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-computation-type">Computation Type</Label>
                <Input
                  id="add-computation-type"
                  value={computationType}
                  onChange={(e) => setComputationType(e.target.value)}
                  placeholder="e.g. linear_interpolation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-params-json">Parameters (JSON object)</Label>
                <Textarea
                  id="add-params-json"
                  value={paramsJson}
                  onChange={(e) => {
                    setParamsJson(e.target.value);
                    setJsonError("");
                  }}
                  placeholder='{"slope": 1.5, "intercept": 0}'
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
              <Button
                onClick={handleAdd}
                disabled={!analyteKey || !computationType || !paramsJson}
              >
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
            <DialogTitle>Edit Computed Recommendation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-analyte-key">Analyte Key</Label>
              <Input
                id="edit-analyte-key"
                value={analyteKey}
                onChange={(e) => setAnalyteKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-computation-type">Computation Type</Label>
              <Input
                id="edit-computation-type"
                value={computationType}
                onChange={(e) => setComputationType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-params-json">Parameters (JSON object)</Label>
              <Textarea
                id="edit-params-json"
                value={paramsJson}
                onChange={(e) => {
                  setParamsJson(e.target.value);
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
            <Button
              onClick={handleEdit}
              disabled={!analyteKey || !computationType || !paramsJson}
            >
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
                <TableHead>Analyte Key</TableHead>
                <TableHead>Computation Type</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No computed recommendations configured.
                  </TableCell>
                </TableRow>
              )}
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.analyte_key}</TableCell>
                  <TableCell>{item.computation_type}</TableCell>
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
                            <DialogTitle>Delete Computation</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete the computation for &quot;{item.analyte_key}&quot;?
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

export default function ComputationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ComputationsPageInner />
    </Suspense>
  );
}
