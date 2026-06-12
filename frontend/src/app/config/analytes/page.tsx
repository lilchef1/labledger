"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";

import { apiPost, apiPatch, apiPut, apiDelete } from "@/lib/api";
import { useScopedAnalytes, scopedCreateUrl } from "@/lib/hooks/use-admin";
import type { Analyte, RatingBucket } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

// ---------------------------------------------------------------------------
// Types for form state
// ---------------------------------------------------------------------------
interface AnalyteFormData {
  key: string;
  display_name: string;
  unit: string;
  color: string;
  sort_order: number;
  has_recommendation: boolean;
  recommendation_threshold: number | null;
  recommendation_operator: string;
  section_name: string;
}

const EMPTY_FORM: AnalyteFormData = {
  key: "",
  display_name: "",
  unit: "",
  color: "#22c55e",
  sort_order: 0,
  has_recommendation: false,
  recommendation_threshold: null,
  recommendation_operator: "<=",
  section_name: "",
};

interface BucketRow {
  label: string;
  range_text: string;
  upper_breakpoint: string;
}

// ---------------------------------------------------------------------------
// Operator labels
// ---------------------------------------------------------------------------
const OPERATORS: { value: string; label: string }[] = [
  { value: "<=", label: "<= (at or below)" },
  { value: ">=", label: ">= (at or above)" },
  { value: "<", label: "< (below)" },
  { value: ">", label: "> (above)" },
];

// ---------------------------------------------------------------------------
// Inner component (needs Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------
function AnalytesPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const { data: analytes, isLoading, mutate } = useScopedAnalytes(scope);

  // Analyte dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnalyte, setEditingAnalyte] = useState<Analyte | null>(null);
  const [form, setForm] = useState<AnalyteFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Analyte | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Bucket editor state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingBucketsFor, setEditingBucketsFor] = useState<number | null>(null);
  const [bucketRows, setBucketRows] = useState<BucketRow[]>([]);
  const [savingBuckets, setSavingBuckets] = useState(false);

  // ------ Analyte form helpers ------

  const openCreate = useCallback(() => {
    setEditingAnalyte(null);
    setForm({
      ...EMPTY_FORM,
      sort_order: analytes?.length ?? 0,
    });
    setDialogOpen(true);
  }, [analytes]);

  const openEdit = useCallback((a: Analyte) => {
    setEditingAnalyte(a);
    setForm({
      key: a.key,
      display_name: a.display_name,
      unit: a.unit,
      color: a.color,
      sort_order: a.sort_order,
      has_recommendation: a.has_recommendation,
      recommendation_threshold: a.recommendation_threshold,
      recommendation_operator: a.recommendation_operator,
      section_name: a.section_name ?? "",
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        section_name: form.section_name || null,
        recommendation_threshold: form.has_recommendation
          ? form.recommendation_threshold
          : null,
      };
      if (editingAnalyte) {
        await apiPatch(`/api/admin/analytes/${editingAnalyte.id}`, payload);
      } else {
        await apiPost(scopedCreateUrl(scope, "analytes"), payload);
      }
      await mutate();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }, [scope, form, editingAnalyte, mutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await apiDelete(`/api/admin/analytes/${deleteTarget.id}`);
    await mutate();
    setDeleteOpen(false);
    setDeleteTarget(null);
  }, [deleteTarget, mutate]);

  const setField = useCallback(
    <K extends keyof AnalyteFormData>(key: K, value: AnalyteFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ------ Bucket editor helpers ------

  const toggleExpand = useCallback(
    (id: number) => {
      setExpandedId((prev) => (prev === id ? null : id));
      if (expandedId === id) {
        setEditingBucketsFor(null);
      }
    },
    [expandedId],
  );

  const startEditBuckets = useCallback((a: Analyte) => {
    setEditingBucketsFor(a.id);
    setBucketRows(
      a.rating_buckets
        .slice()
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((b) => ({
          label: b.label,
          range_text: b.range_text,
          upper_breakpoint:
            b.upper_breakpoint != null ? String(b.upper_breakpoint) : "",
        })),
    );
  }, []);

  const cancelEditBuckets = useCallback(() => {
    setEditingBucketsFor(null);
    setBucketRows([]);
  }, []);

  const addBucketRow = useCallback(() => {
    setBucketRows((prev) => [
      ...prev,
      { label: "", range_text: "", upper_breakpoint: "" },
    ]);
  }, []);

  const removeBucketRow = useCallback((idx: number) => {
    setBucketRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateBucketRow = useCallback(
    (idx: number, field: keyof BucketRow, value: string) => {
      setBucketRows((prev) =>
        prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const saveBuckets = useCallback(async () => {
    if (editingBucketsFor == null) return;
    setSavingBuckets(true);
    try {
      const payload = bucketRows.map((row, idx) => ({
        sort_order: idx,
        label: row.label,
        range_text: row.range_text,
        upper_breakpoint:
          row.upper_breakpoint === "" ? null : Number(row.upper_breakpoint),
      }));
      await apiPut(
        `/api/admin/analytes/${editingBucketsFor}/buckets`,
        payload,
      );
      await mutate();
      setEditingBucketsFor(null);
    } finally {
      setSavingBuckets(false);
    }
  }, [editingBucketsFor, bucketRows, mutate]);

  // ------ Render ------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ScopeSelector />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
        <Card>
          <CardContent className="space-y-3 pt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytes</h1>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add Analyte
        </Button>
      </div>

      {/* Analyte list */}
      {!analytes || analytes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No analytes configured yet. Add one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {analytes
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((analyte) => {
              const isExpanded = expandedId === analyte.id;
              const isEditingBuckets = editingBucketsFor === analyte.id;
              const buckets = (analyte.rating_buckets ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order);

              return (
                <Card key={analyte.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block h-4 w-4 shrink-0 rounded-full border"
                          style={{ backgroundColor: analyte.color }}
                        />
                        <div>
                          <CardTitle className="text-base">
                            {analyte.display_name}
                          </CardTitle>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {analyte.key} · {analyte.unit}
                            {analyte.section_name &&
                              ` · ${analyte.section_name}`}
                            {" · order "}
                            {analyte.sort_order}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(analyte)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setDeleteTarget(analyte);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(analyte.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                      Rating Buckets
                      <Badge variant="secondary" className="ml-1">
                        {buckets.length}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="mt-3">
                        {isEditingBuckets ? (
                          <BucketEditor
                            rows={bucketRows}
                            saving={savingBuckets}
                            onUpdate={updateBucketRow}
                            onAdd={addBucketRow}
                            onRemove={removeBucketRow}
                            onSave={saveBuckets}
                            onCancel={cancelEditBuckets}
                          />
                        ) : (
                          <>
                            {buckets.length === 0 ? (
                              <p className="py-3 text-xs text-muted-foreground">
                                No rating buckets defined.
                              </p>
                            ) : (
                              <BucketTable buckets={buckets} />
                            )}
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditBuckets(analyte)}
                              >
                                <Pencil data-icon="inline-start" />
                                Edit Buckets
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* ---- Analyte Create/Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAnalyte ? "Edit Analyte" : "Add Analyte"}
            </DialogTitle>
            <DialogDescription>
              {editingAnalyte
                ? "Update analyte properties."
                : "Configure a new analyte for this scope."}
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
                <Label htmlFor="analyte-key">Key</Label>
                <Input
                  id="analyte-key"
                  value={form.key}
                  onChange={(e) => setField("key", e.target.value)}
                  placeholder="e.g. pH"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="analyte-display">Display Name</Label>
                <Input
                  id="analyte-display"
                  value={form.display_name}
                  onChange={(e) => setField("display_name", e.target.value)}
                  placeholder="e.g. pH"
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="analyte-unit">Unit</Label>
                <Input
                  id="analyte-unit"
                  value={form.unit}
                  onChange={(e) => setField("unit", e.target.value)}
                  placeholder="e.g. ppm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="analyte-color">Color</Label>
                <Input
                  id="analyte-color"
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  placeholder="#22c55e"
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="analyte-sort">Sort Order</Label>
                <Input
                  id="analyte-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setField("sort_order", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="analyte-section">Section Name</Label>
                <Input
                  id="analyte-section"
                  value={form.section_name}
                  onChange={(e) => setField("section_name", e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.has_recommendation}
                  onChange={(e) =>
                    setField("has_recommendation", e.target.checked)
                  }
                  className="rounded border-input"
                />
                Has recommendation
              </label>

              {form.has_recommendation && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="analyte-operator">Operator</Label>
                    <Select
                      value={form.recommendation_operator}
                      onValueChange={(val) =>
                        setField("recommendation_operator", val ?? "")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="analyte-threshold">Threshold</Label>
                    <Input
                      id="analyte-threshold"
                      type="number"
                      step="any"
                      value={form.recommendation_threshold ?? ""}
                      onChange={(e) =>
                        setField(
                          "recommendation_threshold",
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.key}>
              {saving ? "Saving..." : editingAnalyte ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation Dialog ---- */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Analyte</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.display_name}</strong> and all its rating
              buckets. This action cannot be undone.
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
// Page (with Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------
export default function AnalytesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AnalytesPageInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// BucketTable
// ---------------------------------------------------------------------------
function BucketTable({ buckets }: { buckets: RatingBucket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Order</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>Range</TableHead>
          <TableHead className="text-right">Upper Breakpoint</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="text-muted-foreground">
              {b.sort_order}
            </TableCell>
            <TableCell className="font-medium">{b.label}</TableCell>
            <TableCell>{b.range_text}</TableCell>
            <TableCell className="text-right">
              {b.upper_breakpoint != null ? b.upper_breakpoint : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// BucketEditor
// ---------------------------------------------------------------------------
function BucketEditor({
  rows,
  saving,
  onUpdate,
  onAdd,
  onRemove,
  onSave,
  onCancel,
}: {
  rows: BucketRow[];
  saving: boolean;
  onUpdate: (idx: number, field: keyof BucketRow, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Order</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Range Text</TableHead>
            <TableHead>Upper Breakpoint</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell className="text-muted-foreground">{idx}</TableCell>
              <TableCell>
                <Input
                  value={row.label}
                  onChange={(e) => onUpdate(idx, "label", e.target.value)}
                  placeholder="Label"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={row.range_text}
                  onChange={(e) => onUpdate(idx, "range_text", e.target.value)}
                  placeholder="0-3"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="any"
                  value={row.upper_breakpoint}
                  onChange={(e) =>
                    onUpdate(idx, "upper_breakpoint", e.target.value)
                  }
                  placeholder="blank = none"
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(idx)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus data-icon="inline-start" />
          Add Row
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Buckets"}
        </Button>
      </div>
    </div>
  );
}
