"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useColumns, useFieldKeys, useTemplate, useTemplatePlaceholders } from "@/lib/hooks/use-admin";
import { apiPost, apiPatch, apiDelete, apiPut, apiUpload } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Plus, Pencil, Trash2, Check, X, AlertTriangle, Eye } from "lucide-react";
import { ConfigBreadcrumb } from "@/components/config/config-breadcrumb";
import type { SpreadsheetColumn, FieldKey, DetectedColumn, TemplatePlaceholder } from "@/lib/types";

// ---------------------------------------------------------------------------
// Detection result row
// ---------------------------------------------------------------------------

function DetectedRow({
  col,
  fieldKeys,
  selected,
  onSelect,
  onMap,
  dataTypeOverride,
}: {
  col: DetectedColumn;
  fieldKeys: FieldKey[];
  selected: boolean;
  onSelect: (header: string, checked: boolean, shiftKey: boolean) => void;
  onMap: (header: string, keyId: number | null, dataType: string, decimalPlaces: number | null) => void;
  dataTypeOverride?: string;
}) {
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(col.suggested_key_id);
  const [dataType, setDataType] = useState(col.detected_type);
  const [decimalPlaces, setDecimalPlaces] = useState<number | null>(col.decimal_places);
  const [dismissedFlags, setDismissedFlags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (dataTypeOverride) {
      setDataType(dataTypeOverride);
      if (dataTypeOverride === "numeric") setDecimalPlaces((prev) => prev ?? 0);
      else setDecimalPlaces(null);
    }
  }, [dataTypeOverride]);

  const visibleFlags = col.flags.filter((f) => !dismissedFlags.has(f));

  function dismissFlag(flag: string) {
    setDismissedFlags((prev) => new Set([...prev, flag]));
  }

  const confidenceColor =
    col.match_confidence === "auto"
      ? "default"
      : col.match_confidence === "suggested"
        ? "secondary"
        : "outline";

  return (
    <TableRow className={visibleFlags.length > 0 ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
      <TableCell className="w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(col.header, e.target.checked, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false)}
          className="rounded border-gray-300"
        />
      </TableCell>
      <TableCell>
        <div>
          <span className="font-medium">{col.header}</span>
          <div className="text-xs text-muted-foreground mt-0.5">
            {col.sample_values.slice(0, 3).join(", ")}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select
            value={dataType}
            onValueChange={(val) => {
              setDataType(val ?? "text");
              if (val === "numeric") setDecimalPlaces((prev) => prev ?? 0);
              else setDecimalPlaces(null);
            }}
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
          {dataType === "numeric" && (
            <Input
              type="number"
              min={0}
              max={10}
              value={decimalPlaces ?? ""}
              onChange={(e) => setDecimalPlaces(e.target.value ? Number(e.target.value) : null)}
              placeholder="dp"
              className="h-7 w-16"
            />
          )}
        </div>
        {visibleFlags.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-600">
              {visibleFlags.includes("possible_undelimited_date")
                ? "Could be a date (MMDDYYYY)"
                : visibleFlags.find((f) => f.startsWith("key_type:"))
                  ? `No data — matched key is ${visibleFlags.find((f) => f.startsWith("key_type:"))?.split(":")[1]}`
                  : visibleFlags.includes("no_data")
                    ? "No data in sample rows"
                    : visibleFlags.join(", ")}
            </span>
            <button
              type="button"
              onClick={() => visibleFlags.forEach((f) => dismissFlag(f))}
              className="ml-1 text-amber-400 hover:text-amber-600 shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select
            value={selectedKeyId != null ? String(selectedKeyId) : ""}
            onValueChange={(val) => setSelectedKeyId(val === "__none__" ? null : val ? Number(val) : null)}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Select key...">
                {selectedKeyId != null
                  ? fieldKeys.find((fk) => fk.id === selectedKeyId)?.display_name ?? ""
                  : "None"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {fieldKeys.map((fk) => (
                  <SelectItem key={fk.id} value={String(fk.id)}>
                    {fk.display_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Badge variant={confidenceColor}>
            {col.match_confidence}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          onClick={() => onMap(col.header, selectedKeyId, dataType, decimalPlaces)}
        >
          <Check className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Existing column row (inline editable)
// ---------------------------------------------------------------------------

function ColumnRow({
  col,
  fieldKeys,
  onSaved,
  onDeleted,
  selected,
  onSelect,
}: {
  col: SpreadsheetColumn;
  fieldKeys: FieldKey[];
  onSaved: () => void;
  onDeleted: () => void;
  selected: boolean;
  onSelect: (id: number, checked: boolean, shiftKey: boolean) => void;
}) {
  const [dataType, setDataType] = useState(col.data_type ?? "text");
  const [decimalPlaces, setDecimalPlaces] = useState<number | null>(col.decimal_places);

  async function patchField(patch: Record<string, unknown>) {
    await apiPatch(`/api/admin/columns/${col.id}`, patch);
    onSaved();
  }

  async function handleTypeChange(newType: string) {
    setDataType(newType);
    const dp = newType === "numeric" ? (decimalPlaces ?? 0) : null;
    setDecimalPlaces(dp);
    await patchField({ data_type: newType, decimal_places: dp });
  }

  async function handleDpChange(dp: number | null) {
    setDecimalPlaces(dp);
    await patchField({ decimal_places: dp });
  }

  async function remove() {
    if (!confirm("Delete this column mapping?")) return;
    await apiDelete(`/api/admin/columns/${col.id}`);
    onDeleted();
  }

  const linkedKey = fieldKeys.find((fk) => fk.id === col.field_key_id);

  return (
    <TableRow>
      <TableCell className="w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(col.id, e.target.checked, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false)}
          className="rounded border-gray-300"
        />
      </TableCell>
      <TableCell>
        <span className="font-medium">{col.header_name}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select value={dataType} onValueChange={handleTypeChange}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">text</SelectItem>
              <SelectItem value="numeric">numeric</SelectItem>
              <SelectItem value="date">date</SelectItem>
            </SelectContent>
          </Select>
          {dataType === "numeric" && (
            <Input
              type="number"
              min={0}
              max={10}
              value={decimalPlaces ?? ""}
              onChange={(e) => handleDpChange(e.target.value ? Number(e.target.value) : null)}
              placeholder="dp"
              className="h-7 w-16"
            />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          {linkedKey ? (
            <span>{linkedKey.display_name}</span>
          ) : (
            <span className="text-muted-foreground">Unmapped</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-xs" onClick={remove}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Placeholder mapping row
// ---------------------------------------------------------------------------

function PlaceholderRow({
  ph,
  fieldKeys,
  onChange,
}: {
  ph: TemplatePlaceholder;
  fieldKeys: FieldKey[];
  onChange: (phText: string, keyId: number | null) => void;
}) {
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(ph.field_key_id);

  useEffect(() => {
    setSelectedKeyId(ph.field_key_id);
  }, [ph.field_key_id]);

  function handleChange(val: string | null) {
    const keyId = val ? Number(val) : null;
    setSelectedKeyId(keyId);
    onChange(ph.placeholder_text, keyId);
  }

  return (
    <TableRow>
      <TableCell>
        <Select
          value={selectedKeyId != null ? String(selectedKeyId) : ""}
          onValueChange={handleChange}
        >
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="Select key...">
              {selectedKeyId != null
                ? fieldKeys.find((fk) => fk.id === selectedKeyId)?.display_name ?? ""
                : ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
              {fieldKeys.map((fk) => (
                <SelectItem key={fk.id} value={String(fk.id)}>
                  {fk.display_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {ph.column_ref && (
          <div className="text-xs text-muted-foreground mt-0.5">
            &larr; &quot;{ph.column_ref}&quot; from spreadsheet
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">[{ph.placeholder_text}]</code>
          {ph.field_key_id ? (
            <Badge variant="default">mapped</Badge>
          ) : (
            <Badge variant="outline">unmapped</Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MappingPage() {
  const params = useParams<{ disciplineId: string }>();
  const discId = params.disciplineId ? Number(params.disciplineId) : null;

  // --- Spreadsheet / column hooks ---
  const { data: columns, isLoading: columnsLoading, mutate } = useColumns(discId);
  const { data: fieldKeys, mutate: mutateKeys } = useFieldKeys(discId);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedColumn[] | null>(null);
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set());
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({});
  const lastSelectedIdx = useRef<number | null>(null);

  // --- Template hooks ---
  const { data: template, isLoading: templateLoading, error: templateError, mutate: mutateTemplate } = useTemplate(discId);
  const { data: placeholders, mutate: mutatePhs } = useTemplatePlaceholders(discId);

  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [pendingMappings, setPendingMappings] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (template) {
      setHtml(template.template_html);
      setDirty(false);
    }
  }, [template]);

  // --- Spreadsheet handlers ---

  function handleSelectRow(header: string, checked: boolean, shiftKey: boolean) {
    if (!detected) return;
    const currentIdx = detected.findIndex((c) => c.header === header);
    if (shiftKey && checked && lastSelectedIdx.current !== null && lastSelectedIdx.current !== currentIdx) {
      const start = Math.min(lastSelectedIdx.current, currentIdx);
      const end = Math.max(lastSelectedIdx.current, currentIdx);
      setSelectedHeaders((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(detected[i].header);
        return next;
      });
    } else {
      setSelectedHeaders((prev) => {
        const next = new Set(prev);
        if (checked) next.add(header);
        else next.delete(header);
        return next;
      });
    }
    if (checked) lastSelectedIdx.current = currentIdx;
  }

  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<number>>(new Set());
  const lastSelectedColIdx = useRef<number | null>(null);

  function handleSelectColumn(id: number, checked: boolean, shiftKey: boolean) {
    if (!columns) return;
    const currentIdx = columns.findIndex((c) => c.id === id);
    if (shiftKey && checked && lastSelectedColIdx.current !== null && lastSelectedColIdx.current !== currentIdx) {
      const start = Math.min(lastSelectedColIdx.current, currentIdx);
      const end = Math.max(lastSelectedColIdx.current, currentIdx);
      setSelectedColumnIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(columns[i].id);
        return next;
      });
    } else {
      setSelectedColumnIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    if (checked) lastSelectedColIdx.current = currentIdx;
  }

  async function handleRemoveSelected() {
    if (selectedColumnIds.size === 0) return;
    if (!confirm(`Delete ${selectedColumnIds.size} column mapping${selectedColumnIds.size !== 1 ? "s" : ""}?`)) return;
    await Promise.all([...selectedColumnIds].map((id) => apiDelete(`/api/admin/columns/${id}`)));
    setSelectedColumnIds(new Set());
    lastSelectedColIdx.current = null;
    mutate();
  }

  async function handleRemoveAll() {
    if (!columns || columns.length === 0) return;
    if (!confirm(`Delete all ${columns.length} column mappings?`)) return;
    await Promise.all(columns.map((col) => apiDelete(`/api/admin/columns/${col.id}`)));
    setSelectedColumnIds(new Set());
    lastSelectedColIdx.current = null;
    mutate();
  }

  function applyBulkType(newType: string) {
    setTypeOverrides((prev) => {
      const next = { ...prev };
      for (const h of selectedHeaders) {
        next[h] = newType;
      }
      return next;
    });
    setSelectedHeaders(new Set());
  }

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !discId) return;
      setDetecting(true);
      try {
        const result = await apiUpload<DetectedColumn[]>(
          `/api/admin/disciplines/${discId}/columns/detect`,
          file
        );
        setDetected(result);
      } finally {
        setDetecting(false);
        e.target.value = "";
      }
    },
    [discId]
  );

  async function handleMapDetected(
    header: string,
    keyId: number | null,
    dataType: string,
    decimalPlaces: number | null
  ) {
    if (!discId) return;

    let fkId = keyId;
    if (!fkId) {
      const slug = header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const created = await apiPost<{ id: number; name: string }>(
        `/api/admin/disciplines/${discId}/field-keys`,
        { name: slug, display_name: header, data_type: dataType, decimal_places: decimalPlaces }
      );
      fkId = created.id;
      mutateKeys();
    }

    await apiPost(`/api/admin/disciplines/${discId}/columns`, {
      internal_key: header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      header_name: header,
      field_key_id: fkId,
      data_type: dataType,
      decimal_places: decimalPlaces,
      detected_type: dataType,
    });

    setDetected((prev) => prev?.filter((d) => d.header !== header) ?? null);
    mutate();
  }

  async function handleMapAll() {
    if (!detected || !discId) return;
    for (const col of detected) {
      await handleMapDetected(
        col.header,
        col.suggested_key_id,
        col.detected_type,
        col.decimal_places
      );
    }
    setDetected(null);
  }

  // --- Template handlers ---

  function handleTemplateChange(value: string) {
    setHtml(value);
    setDirty(value !== (template?.template_html ?? ""));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const name = file.name.toLowerCase();
    if (name.endsWith(".html") || name.endsWith(".htm")) {
      const text = await file.text();
      setHtml(text);
      setDirty(true);
      return;
    }

    try {
      const result = await apiUpload<{ html: string }>("/api/admin/template/convert", file);
      setHtml(result.html);
      setDirty(true);
    } catch (err) {
      alert(`Conversion failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function saveTemplate() {
    if (!discId) return;
    setSaving(true);
    try {
      await apiPut(`/api/admin/disciplines/${discId}/template`, { template_html: html });
      await mutateTemplate();
      await mutatePhs();
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function handleMappingChange(phText: string, keyId: number | null) {
    setPendingMappings((prev) => ({ ...prev, [phText]: keyId }));
  }

  async function saveMappings() {
    if (!discId) return;
    setSavingMappings(true);
    try {
      const body = Object.entries(pendingMappings).map(([placeholder_text, field_key_id]) => ({
        placeholder_text,
        field_key_id,
      }));
      await apiPut(`/api/admin/disciplines/${discId}/template/placeholders`, body);
      await mutatePhs();
      setPendingMappings({});
    } finally {
      setSavingMappings(false);
    }
  }

  const hasPendingMappings = Object.keys(pendingMappings).length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <ConfigBreadcrumb section="mapping" />
        <h1 className="text-lg font-semibold">Data Mapping</h1>
        <div className="w-24" />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL: Spreadsheet */}
        <div className="w-1/2 border-r overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Spreadsheet Columns</h2>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={detecting} />
              <Button variant="outline" size="sm" nativeButton={false} render={<span />}>
                <Upload data-icon="inline-start" />
                {detecting ? "Detecting..." : "Upload Spreadsheet"}
              </Button>
            </label>
          </div>

          {/* Detection results */}
          {detected && detected.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  {detected.length} column{detected.length !== 1 ? "s" : ""} detected
                </span>
                <div className="flex items-center gap-2">
                  {selectedHeaders.size > 0 && (
                    <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">{selectedHeaders.size} selected</span>
                      <span className="text-xs text-muted-foreground">Set type:</span>
                      <Button size="sm" variant="outline" onClick={() => applyBulkType("numeric")}>Numeric</Button>
                      <Button size="sm" variant="outline" onClick={() => applyBulkType("text")}>Text</Button>
                      <Button size="sm" variant="outline" onClick={() => applyBulkType("date")}>Date</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedHeaders(new Set())}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={handleMapAll}>
                    Accept All
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Spreadsheet Header</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Map to Key</TableHead>
                    <TableHead className="w-14">Save</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detected.map((col) => (
                    <DetectedRow
                      key={col.header}
                      col={col}
                      fieldKeys={fieldKeys ?? []}
                      selected={selectedHeaders.has(col.header)}
                      onSelect={handleSelectRow}
                      onMap={handleMapDetected}
                      dataTypeOverride={typeOverrides[col.header]}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {detected && detected.length === 0 && (
            <p className="text-sm text-muted-foreground">All columns mapped.</p>
          )}

          {/* Saved column mappings */}
          {(columns?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Saved Mappings ({columns?.length ?? 0})
                </h3>
                <div className="flex items-center gap-2">
                  {selectedColumnIds.size > 0 && (
                    <div className="flex items-center gap-2 border rounded-md px-2 py-1">
                      <span className="text-xs text-muted-foreground">{selectedColumnIds.size} selected</span>
                      <Button size="sm" variant="outline" onClick={handleRemoveSelected}>Delete</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedColumnIds(new Set()); lastSelectedColIdx.current = null; }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={handleRemoveAll}>Remove All</Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Spreadsheet Header</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Field Key</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns?.map((col) => (
                    <ColumnRow
                      key={col.id}
                      col={col}
                      fieldKeys={fieldKeys ?? []}
                      onSaved={() => mutate()}
                      onDeleted={() => { setSelectedColumnIds((prev) => { const next = new Set(prev); next.delete(col.id); return next; }); mutate(); }}
                      selected={selectedColumnIds.has(col.id)}
                      onSelect={handleSelectColumn}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!detected && (columns?.length ?? 0) === 0 && !columnsLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Upload className="h-8 w-8 mb-2" />
              <p className="text-sm">Upload a spreadsheet to get started</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Template */}
        <div className="w-1/2 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Report Template</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => document.getElementById("template-upload")?.click()}>
                <Upload data-icon="inline-start" /> Upload Template
              </Button>
              <input id="template-upload" type="file" accept=".html,.htm,.xlsx,.xls,.csv,.docx" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" size="sm" disabled={!html} onClick={async () => {
                const res = await fetch("http://localhost:8000/api/admin/template/preview", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ template_html: html }),
                });
                if (!res.ok) { alert("Preview failed"); return; }
                const blob = await res.blob();
                window.open(URL.createObjectURL(blob), "_blank");
              }}>
                <Eye data-icon="inline-start" /> Preview
              </Button>
              <Button size="sm" onClick={saveTemplate} disabled={saving || !dirty}>
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}

          {/* Template HTML textarea */}
          <Textarea
            value={html}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="min-h-[200px] max-h-[300px] font-mono text-xs"
            placeholder="Upload a template file or paste HTML here..."
            spellCheck={false}
          />

          {/* Placeholder mapping */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Placeholder Mapping {placeholders && placeholders.length > 0 && `(${placeholders.length})`}
            </h3>
            {!placeholders || placeholders.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                Upload and save a template to see placeholders here.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Key</TableHead>
                      <TableHead>Template Placeholder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placeholders.map((ph) => (
                      <PlaceholderRow
                        key={ph.id}
                        ph={ph}
                        fieldKeys={fieldKeys ?? []}
                        onChange={handleMappingChange}
                      />
                    ))}
                  </TableBody>
                </Table>
                {hasPendingMappings && (
                  <div className="mt-4 flex items-center gap-3">
                    <Button onClick={saveMappings} disabled={savingMappings}>
                      <Check data-icon="inline-start" />
                      {savingMappings ? "Saving..." : `Save ${Object.keys(pendingMappings).length} mapping${Object.keys(pendingMappings).length !== 1 ? "s" : ""}`}
                    </Button>
                    <Button variant="ghost" onClick={() => setPendingMappings({})}>
                      Discard
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
