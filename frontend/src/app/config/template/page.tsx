"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useFieldKeys,
  useTemplateList,
  useTemplateById,
  useTemplatePlaceholdersById,
} from "@/lib/hooks/use-admin";
import { apiPut, apiUpload, apiPost, apiDelete } from "@/lib/api";
import { ScopeSelector } from "@/components/config/scope-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Upload, Plus, Trash2 } from "lucide-react";
import type { FieldKey, TemplatePlaceholder } from "@/lib/types";

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
          {ph.match_confidence === "suggested" ? (
            <Badge variant="secondary">review</Badge>
          ) : ph.match_confidence === "auto" ? (
            <Badge variant="default">auto-matched</Badge>
          ) : ph.field_key_id ? (
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
// Inner component (uses useSearchParams)
// ---------------------------------------------------------------------------

function TemplatePageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "global";
  const discId = scope !== "global" ? Number(scope) : null;

  const { data: templateList, mutate: mutateList } = useTemplateList(discId);
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);

  // Reset active template when scope changes
  useEffect(() => {
    setActiveTemplateId(null);
  }, [scope]);

  useEffect(() => {
    if (templateList && templateList.length > 0 && activeTemplateId === null) {
      setActiveTemplateId(templateList[0].id);
    }
  }, [templateList, activeTemplateId]);

  const { data: template, isLoading, error: templateError, mutate: mutateTemplate } = useTemplateById(activeTemplateId);
  const { data: fieldKeys } = useFieldKeys(discId);
  const { data: placeholders, mutate: mutatePhs } = useTemplatePlaceholdersById(activeTemplateId);

  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [pendingMappings, setPendingMappings] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (template) {
      setHtml(template.template_html);
      setDirty(false);
      setPendingMappings({});
    }
  }, [template]);

  function handleChange(value: string) {
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
    if (!activeTemplateId) return;
    setSaving(true);
    try {
      await apiPut(`/api/admin/templates/${activeTemplateId}`, { template_html: html });
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
    if (!activeTemplateId) return;
    setSavingMappings(true);
    try {
      const body = Object.entries(pendingMappings).map(([placeholder_text, field_key_id]) => ({
        placeholder_text,
        field_key_id,
      }));
      await apiPut(`/api/admin/templates/${activeTemplateId}/placeholders`, body);
      await mutatePhs();
      setPendingMappings({});
    } finally {
      setSavingMappings(false);
    }
  }

  async function handleCreateTemplate() {
    if (!discId) return;
    const name = prompt("Template name:");
    if (!name) return;
    try {
      const result = await apiPost<{ id: number }>(`/api/admin/disciplines/${discId}/templates`, {
        template_html: "<p>New template</p>",
        name,
      });
      await mutateList();
      setActiveTemplateId(result.id);
    } catch (err) {
      alert(`Failed to create template: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function handleDeleteTemplate() {
    if (!activeTemplateId) return;
    const name = templateList?.find((t) => t.id === activeTemplateId)?.name ?? "this template";
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/admin/templates/${activeTemplateId}`);
      setActiveTemplateId(null);
      await mutateList();
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }
  }

  const hasPendingMappings = Object.keys(pendingMappings).length > 0;
  const hasMultipleTemplates = templateList && templateList.length > 1;

  return (
    <div className="space-y-6">
      <ScopeSelector />

      {scope === "global" ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Select a discipline to manage templates.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Template selector */}
          <div className="flex items-center gap-3">
            {templateList && templateList.length > 0 && (
              <Select
                value={activeTemplateId != null ? String(activeTemplateId) : ""}
                onValueChange={(v) => setActiveTemplateId(v ? Number(v) : null)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select template...">
                    {activeTemplateId != null
                      ? templateList?.find((t) => t.id === activeTemplateId)?.name ?? ""
                      : ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templateList.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} ({t.placeholder_count} placeholders)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={handleCreateTemplate}>
              <Plus data-icon="inline-start" /> New Template
            </Button>
            {hasMultipleTemplates && activeTemplateId && (
              <Button variant="ghost" size="sm" onClick={handleDeleteTemplate}>
                <Trash2 className="text-destructive" data-icon="inline-start" /> Delete
              </Button>
            )}
          </div>

          {activeTemplateId && (
            <Tabs defaultValue="mapping">
              <TabsList>
                <TabsTrigger value="mapping">Placeholder Mapping</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="html">Template HTML</TabsTrigger>
              </TabsList>

              <TabsContent value="mapping" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Template Placeholders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-32 w-full" />
                    ) : !placeholders || placeholders.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No placeholders found. Save a template with [bracketed] placeholders to populate this list.
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Template Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {html ? (
                      <iframe
                        srcDoc={html}
                        className="w-full border rounded"
                        style={{ height: "800px" }}
                        sandbox=""
                        title="Template preview"
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Upload or paste a template to see a preview.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="html" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Report Template HTML</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoading && !templateError ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <>
                        <Textarea
                          value={html}
                          onChange={(e) => handleChange(e.target.value)}
                          className="min-h-[400px] font-mono text-xs"
                          placeholder="Paste template HTML here or upload a file..."
                          spellCheck={false}
                        />
                        <div className="flex items-center gap-3">
                          <Button onClick={saveTemplate} disabled={saving || !dirty}>
                            {saving ? "Saving..." : "Save Template"}
                          </Button>
                          <Button variant="outline" onClick={() => document.getElementById("template-upload")?.click()}>
                            <Upload data-icon="inline-start" /> Upload Template
                          </Button>
                          <input id="template-upload" type="file" accept=".html,.htm,.xlsx,.xls,.csv,.docx" className="hidden" onChange={handleFileUpload} />
                          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------

export default function TemplatePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TemplatePageInner />
    </Suspense>
  );
}
