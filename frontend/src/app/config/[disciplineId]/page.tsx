"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useDiscipline } from "@/lib/hooks/use-admin";
import { apiPatch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil } from "lucide-react";
import { ConfigBreadcrumb } from "@/components/config/config-breadcrumb";
import type { AdminDisciplineDetail } from "@/lib/hooks/use-admin";

// ---------------------------------------------------------------------------
// Discipline Header (editable)
// ---------------------------------------------------------------------------

function DisciplineHeader({ disc, onSaved }: { disc: AdminDisciplineDetail; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: disc.name,
    green_bar_title: disc.green_bar_title,
    spreadsheet_id_prefix: disc.spreadsheet_id_prefix,
    report_filename_pattern: disc.report_filename_pattern,
  });

  function startEditing() {
    setForm({
      name: disc.name,
      green_bar_title: disc.green_bar_title,
      spreadsheet_id_prefix: disc.spreadsheet_id_prefix,
      report_filename_pattern: disc.report_filename_pattern,
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await apiPatch(`/api/admin/disciplines/${disc.id}`, form);
      onSaved();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader><CardTitle>Edit Discipline</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="d-name">Name</Label>
              <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-title">Green Bar Title</Label>
              <Input id="d-title" value={form.green_bar_title} onChange={(e) => setForm({ ...form, green_bar_title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-prefix">Spreadsheet ID Prefix</Label>
              <Input id="d-prefix" value={form.spreadsheet_id_prefix} onChange={(e) => setForm({ ...form, spreadsheet_id_prefix: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-pattern">Report Filename Pattern</Label>
              <Input id="d-pattern" value={form.report_filename_pattern} onChange={(e) => setForm({ ...form, report_filename_pattern: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{disc.name}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={startEditing}>
            <Pencil />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">Green Bar Title:</span> {disc.green_bar_title}</div>
          <div><span className="text-muted-foreground">Spreadsheet ID Prefix:</span> {disc.spreadsheet_id_prefix || "—"}</div>
          <div><span className="text-muted-foreground">Filename Pattern:</span> {disc.report_filename_pattern}</div>
        </dl>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisciplineDetailPage() {
  const params = useParams<{ disciplineId: string }>();
  const discId = params.disciplineId ? Number(params.disciplineId) : null;
  const { data: disc, isLoading, mutate } = useDiscipline(discId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!disc) {
    return (
      <div className="space-y-4">
        <ConfigBreadcrumb />
        <p className="text-muted-foreground">Discipline not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfigBreadcrumb />
      <DisciplineHeader disc={disc} onSaved={() => mutate()} />
    </div>
  );
}
