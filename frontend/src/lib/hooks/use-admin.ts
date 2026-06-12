import useSWR from "swr";
import { apiGet } from "@/lib/api";
import type {
  LabInfo,
  FieldKey,
  Analyte,
  RatingBucket,
  RequestCode,
  SimpleField,
  CustomBlock,
  ComputedRecommendation,
  Trigger,
  ReportTemplate,
  SpreadsheetColumn,
  TemplatePlaceholder,
  TemplateSummary,
} from "@/lib/types";

// --- Admin discipline types (richer than the reports endpoint) ---

export interface AdminDiscipline {
  id: number;
  name: string;
  green_bar_title: string;
  spreadsheet_id_prefix: string;
  report_filename_pattern: string;
}

export interface AdminDisciplineDetail extends AdminDiscipline {
  analyte_count: number;
  column_count: number;
  request_code_count: number;
  simple_field_count: number;
  custom_block_count: number;
  computed_rec_count: number;
  trigger_count: number;
}

// --- Hooks ---

export function useLabInfo() {
  return useSWR<LabInfo>("/api/admin/lab-info", apiGet);
}

export function useDisciplines() {
  return useSWR<AdminDiscipline[]>("/api/admin/disciplines", apiGet);
}

export function useDiscipline(id: number | null) {
  return useSWR<AdminDisciplineDetail>(
    id ? `/api/admin/disciplines/${id}` : null,
    apiGet
  );
}

export function useAnalytes(discId: number | null) {
  return useSWR<Analyte[]>(
    discId ? `/api/admin/disciplines/${discId}/analytes` : null,
    apiGet
  );
}

export function useBuckets(analyteId: number | null) {
  return useSWR<RatingBucket[]>(
    analyteId ? `/api/admin/analytes/${analyteId}/buckets` : null,
    apiGet
  );
}

export function useColumns(discId: number | null) {
  return useSWR<SpreadsheetColumn[]>(
    discId ? `/api/admin/disciplines/${discId}/columns` : null,
    apiGet
  );
}

export function useRequestCodes(discId: number | null) {
  return useSWR<RequestCode[]>(
    discId ? `/api/admin/disciplines/${discId}/request-codes` : null,
    apiGet
  );
}

export function useSimpleFields(discId: number | null) {
  return useSWR<SimpleField[]>(
    discId ? `/api/admin/disciplines/${discId}/simple-fields` : null,
    apiGet
  );
}

export function useCustomBlocks(discId: number | null) {
  return useSWR<CustomBlock[]>(
    discId ? `/api/admin/disciplines/${discId}/custom-blocks` : null,
    apiGet
  );
}

export function useComputedRecs(discId: number | null) {
  return useSWR<ComputedRecommendation[]>(
    discId ? `/api/admin/disciplines/${discId}/computed-recs` : null,
    apiGet
  );
}

export function useTriggers(discId: number | null) {
  return useSWR<Trigger[]>(
    discId ? `/api/admin/disciplines/${discId}/triggers` : null,
    apiGet
  );
}

export function useTemplate(discId: number | null) {
  return useSWR<ReportTemplate>(
    discId ? `/api/admin/disciplines/${discId}/template` : null,
    apiGet
  );
}

export function useFieldKeys(discId: number | null) {
  return useSWR<FieldKey[]>(
    discId ? `/api/admin/disciplines/${discId}/field-keys` : null,
    apiGet
  );
}

export function useTemplatePlaceholders(discId: number | null) {
  return useSWR<TemplatePlaceholder[]>(
    discId ? `/api/admin/disciplines/${discId}/template/placeholders` : null,
    apiGet
  );
}

export function useTemplateList(discId: number | null) {
  return useSWR<TemplateSummary[]>(
    discId ? `/api/admin/disciplines/${discId}/templates` : null,
    apiGet
  );
}

export function useTemplateById(templateId: number | null) {
  return useSWR<ReportTemplate>(
    templateId ? `/api/admin/templates/${templateId}` : null,
    apiGet
  );
}

export function useTemplatePlaceholdersById(templateId: number | null) {
  return useSWR<TemplatePlaceholder[]>(
    templateId ? `/api/admin/templates/${templateId}/placeholders` : null,
    apiGet
  );
}

// ---------------------------------------------------------------------------
// Scope-aware hooks for section-first config UI
//
// `scope` is either "global" or a discipline ID string (e.g. "1").
// Global scope hits /api/admin/global/..., discipline scope hits
// /api/admin/disciplines/{id}/...
// ---------------------------------------------------------------------------

function scopedUrl(scope: string, resource: string): string | null {
  if (!scope) return null;
  if (scope === "global") return `/api/admin/global/${resource}`;
  const id = Number(scope);
  if (Number.isNaN(id)) return null;
  return `/api/admin/disciplines/${id}/${resource}`;
}

export function useScopedAnalytes(scope: string) {
  return useSWR<Analyte[]>(scopedUrl(scope, "analytes"), apiGet);
}

export function useScopedFieldKeys(scope: string) {
  return useSWR<FieldKey[]>(scopedUrl(scope, "field-keys"), apiGet);
}

export function useScopedCustomBlocks(scope: string) {
  return useSWR<CustomBlock[]>(scopedUrl(scope, "custom-blocks"), apiGet);
}

export function useScopedComputedRecs(scope: string) {
  return useSWR<ComputedRecommendation[]>(scopedUrl(scope, "computed-recs"), apiGet);
}

export function useScopedSimpleFields(scope: string) {
  return useSWR<SimpleField[]>(scopedUrl(scope, "simple-fields"), apiGet);
}

export function useScopedTriggers(scope: string) {
  return useSWR<Trigger[]>(scopedUrl(scope, "triggers"), apiGet);
}

// ---------------------------------------------------------------------------
// Scope-aware mutation helpers
// ---------------------------------------------------------------------------

export function scopedCreateUrl(scope: string, resource: string): string {
  if (scope === "global") return `/api/admin/global/${resource}`;
  return `/api/admin/disciplines/${scope}/${resource}`;
}
