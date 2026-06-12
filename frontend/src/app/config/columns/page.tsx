"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Pencil, Trash2, Check, X, AlertTriangle } from "lucide-react";
import { ScopeSelector } from "@/components/config/scope-selector";
import type { SpreadsheetColumn, FieldKey, DetectedColumn } from "@/lib/types";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function columnsUrl(scope: string) {
  return scope === "global"
    ? "/api/admin/global/columns"
    : `/api/admin/disciplines/${scope}/columns`;
}

function fieldKeysUrl(scope: string) {
  return scope === "global"
    ? "/api/admin/global/field-keys"
    : `/api/admin/disciplines/${scope}/field-keys`;
}

function detectUrl(scope: string) {
  return scope === "global"
    ? "/api/admin/global/columns/detect"
    : `/api/admin/disciplines/${scope}/columns/detect`;
}

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

  // Sync data-type override from bulk action
  const prevOverride = useRef(dataTypeOverride);
  if (dataTypeOverride !== prevOverride.current) {
    prevOverride.current = dataTypeOverride;
    if (dataTypeOverride) {
      setDataType(dataTypeOverride);
      if (dataTypeOverride === "numeric") setDecimalPlaces((prev) => prev ?? 0);
      else setDecimalPlaces(null);
    }
  }

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
  const [editing, setEditing] = useState(false);
  const [internalKey, setInternalKey] = useState(col.internal_key);
  const [headerName, setHeaderName] = useState(col.header_name);
  const [fieldKeyId, setFieldKeyId] = useState<number | null>(col.field_key_id);
  const [dataType, setDataType] = useState(col.data_type ?? "text");
  const [decimalPlaces, setDecimalPlaces] = useState<number | null>(col.decimal_places);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setInternalKey(col.internal_key);
    setHeaderName(col.header_name);
    setFieldKeyId(col.field_key_id);
    setDataType(col.data_type ?? "text");
    setDecimalPlaces(col.decimal_places);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await apiPatch(`/api/admin/columns/${col.id}`, {
        internal_key: internalKey,
        header_name: headerName,
        field_key_id: fieldKeyId,
        data_type: dataType,
        decimal_places: decimalPlaces,
      });
      onSaved();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this column mapping?")) return;
    await apiDelete(`/api/admin/columns/${col.id}`);
    onDeleted();
  }

  const linkedKey = fieldKeys.find((fk) => fk.id === col.field_key_id);

  if (editing) {
    return (
      <TableRow>
        <TableCell className="w-8" />
        <TableCell>
          <Input value={headerName} onChange={(e) => setHeaderName(e.target.value)} className="h-7" />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Select
              value={dataType}
              onValueChange={(val) => {
                setDataType(val ?? "text");
                if (val !== "numeric") setDecimalPlaces(null);
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
        </TableCell>
        <TableCell>
          <Select
            value={fieldKeyId != null ? String(fieldKeyId) : ""}
            onValueChange={(val) => setFieldKeyId(val === "__none__" ? null : val ? Number(val) : null)}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Select key...">
                {fieldKeyId != null
                  ? fieldKeys.find((fk) => fk.id === fieldKeyId)?.display_name ?? ""
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
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-xs" onClick={save} disabled={saving}>
              <Check />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(false)}>
              <X />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

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
          <Badge variant="outline">{col.data_type ?? "text"}</Badge>
          {col.data_type === "numeric" && col.decimal_places != null && (
            <span className="text-xs text-muted-foreground">{col.decimal_places}dp</span>
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
          {col.template_refs.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              &rarr; {col.template_refs.map((r) => `[${r}]`).join(", ")}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-xs" onClick={startEditing}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={remove}>
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams, must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function ColumnsPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const discId = scope !== "global" ? Number(scope) : null;

  const { data: columns, isLoading, mutate } = useSWR<SpreadsheetColumn[]>(
    columnsUrl(scope),
    apiGet
  );
  const { data: fieldKeys, mutate: mutateKeys } = useSWR<FieldKey[]>(
    fieldKeysUrl(scope),
    apiGet
  );

  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedColumn[] | null>(null);
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set());
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({});
  const lastSelectedIdx = useRef<number | null>(null);

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
      if (!file) return;
      setDetecting(true);
      try {
        const result = await apiUpload<DetectedColumn[]>(
          detectUrl(scope),
          file
        );
        setDetected(result);
      } finally {
        setDetecting(false);
        e.target.value = "";
      }
    },
    [scope]
  );

  async function handleMapDetected(
    header: string,
    keyId: number | null,
    dataType: string,
    decimalPlaces: number | null
  ) {
    const baseUrl = scope === "global"
      ? "/api/admin/global"
      : `/api/admin/disciplines/${scope}`;

    let fkId = keyId;
    if (!fkId) {
      const slug = header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const created = await apiPost<{ id: number; name: string }>(
        `${baseUrl}/field-keys`,
        { name: slug, display_name: header, data_type: dataType, decimal_places: decimalPlaces }
      );
      fkId = created.id;
      mutateKeys();
    }

    await apiPost(`${baseUrl}/columns`, {
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
    if (!detected) return;
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

  return (
    <div className="space-y-6">
      <ScopeSelector />

      {/* Upload / Detect */}
      <Card>
        <CardHeader>
          <CardTitle>Import from Spreadsheet</CardTitle>
          <CardAction>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleUpload}
                disabled={detecting}
              />
              <Button variant="outline" size="sm" nativeButton={false} render={<span />}>
                <Upload data-icon="inline-start" />
                {detecting ? "Detecting..." : "Upload Spreadsheet"}
              </Button>
            </label>
          </CardAction>
        </CardHeader>
        {detected && detected.length > 0 && (
          <CardContent>
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
          </CardContent>
        )}
        {detected && detected.length === 0 && (
          <CardContent>
            <p className="text-sm text-muted-foreground">All columns mapped.</p>
          </CardContent>
        )}
      </Card>

      {/* Existing Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Column Mappings</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              {selectedColumnIds.size > 0 && (
                <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">{selectedColumnIds.size} selected</span>
                  <Button size="sm" variant="outline" onClick={handleRemoveSelected}>
                    Delete Selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedColumnIds(new Set()); lastSelectedColIdx.current = null; }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                {columns?.length ?? 0} column{columns?.length !== 1 ? "s" : ""}
              </span>
              {columns && columns.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleRemoveAll}>
                  Remove All
                </Button>
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (Suspense boundary required by Next.js for useSearchParams)
// ---------------------------------------------------------------------------

export default function ColumnsPage() {
  return (
    <Suspense>
      <ColumnsPageInner />
    </Suspense>
  );
}
