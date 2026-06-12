"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useScopedTriggers, scopedCreateUrl } from "@/lib/hooks/use-admin";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { Trigger } from "@/lib/types";

const OPERATORS = [
  { value: "lt", label: "< (less than)" },
  { value: "le", label: "<= (less or equal)" },
  { value: "gt", label: "> (greater than)" },
  { value: "ge", label: ">= (greater or equal)" },
  { value: "eq", label: "= (equal)" },
];

const OPERATOR_SYMBOLS: Record<string, string> = {
  lt: "<",
  le: "<=",
  gt: ">",
  ge: ">=",
  eq: "=",
};

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------
function TriggersPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const { data: items, mutate } = useScopedTriggers(scope);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trigger | null>(null);

  // Form state
  const [field, setField] = useState("");
  const [operator, setOperator] = useState("gt");
  const [threshold, setThreshold] = useState(0);
  const [action, setAction] = useState("");

  function resetForm() {
    setField("");
    setOperator("gt");
    setThreshold(0);
    setAction("");
  }

  function openEdit(item: Trigger) {
    setField(item.field);
    setOperator(item.operator);
    setThreshold(item.threshold);
    setAction(item.action);
    setEditing(item);
  }

  async function handleAdd() {
    await apiPost(scopedCreateUrl(scope, "triggers"), {
      field,
      operator,
      threshold,
      action,
    });
    resetForm();
    setAdding(false);
    mutate();
  }

  async function handleEdit() {
    if (!editing) return;
    await apiPatch(`/api/admin/triggers/${editing.id}`, {
      field,
      operator,
      threshold,
      action,
    });
    resetForm();
    setEditing(null);
    mutate();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/admin/triggers/${id}`);
    mutate();
  }

  function renderFormFields(idPrefix: string) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-field`}>Field</Label>
          <Input
            id={`${idPrefix}-field`}
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="e.g. ph"
          />
        </div>
        <div className="space-y-2">
          <Label>Operator</Label>
          <Select value={operator} onValueChange={(v) => setOperator(v ?? "")}>
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
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-threshold`}>Threshold</Label>
          <Input
            id={`${idPrefix}-threshold`}
            type="number"
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-action`}>Action</Label>
          <Input
            id={`${idPrefix}-action`}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. flag_high_ph"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScopeSelector />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Triggers</h1>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" /> Add Trigger
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Trigger</DialogTitle>
              <DialogDescription>
                Define a conditional trigger based on a field value.
              </DialogDescription>
            </DialogHeader>
            {renderFormFields("add")}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleAdd} disabled={!field || !action}>
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
            <DialogTitle>Edit Trigger</DialogTitle>
          </DialogHeader>
          {renderFormFields("edit")}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleEdit} disabled={!field || !action}>
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
                <TableHead>Field</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No triggers configured.
                  </TableCell>
                </TableRow>
              )}
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.field}</TableCell>
                  <TableCell>{OPERATOR_SYMBOLS[item.operator] ?? item.operator}</TableCell>
                  <TableCell>{item.threshold}</TableCell>
                  <TableCell>{item.action}</TableCell>
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
                            <DialogTitle>Delete Trigger</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete the trigger for &quot;{item.field}&quot;?
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
// Page
// ---------------------------------------------------------------------------
export default function TriggersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TriggersPageInner />
    </Suspense>
  );
}
