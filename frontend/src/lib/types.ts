// Disciplines
export interface Discipline {
  id: number;
  name: string;
  title: string;
}

// Batches
export interface BatchSummary {
  id: string;
  filename: string;
  discipline_id: number;
  created_at: string;
  report_count: number;
}

export interface BatchDetail extends BatchSummary {
  reports: ReportSummary[];
}

export interface ReportSummary {
  lab_id: string;
  sample_id: string;
  customer_name: string;
  status: string;
  template_name?: string;
}

// Report detail
export interface AnalyteContext {
  display: string;
  labels: [string, string][];
  active_index: number | null;
  recommendation: string;
  unit_label: string;
  rec_unit: string;
}

export interface ReportDetail {
  lab_id: string;
  status: string;
  comments: string;
  recommendations: Record<string, Record<string, unknown>>;
  context: {
    sample: Record<string, unknown>;
    analytes: Record<string, AnalyteContext>;
    sections: string[];
  };
}

export interface ReportUpdate {
  recommendations?: Record<string, Record<string, unknown>>;
  comments?: string;
  status?: string;
}

// Upload response
export interface UploadResponse {
  batch_id: string;
  filename: string;
  report_count: number;
  lab_ids: string[];
}

// Config models (for admin pages)
export interface Analyte {
  id: number;
  discipline_id: number;
  key: string;
  display_name: string;
  unit: string;
  color: string;
  sort_order: number;
  has_recommendation: boolean;
  recommendation_threshold: number | null;
  recommendation_operator: string;
  section_name: string | null;
  rating_buckets: RatingBucket[];
}

export interface RatingBucket {
  id: number;
  analyte_id: number;
  sort_order: number;
  label: string;
  range_text: string;
  upper_breakpoint: number | null;
}

export interface RequestCode {
  id: number;
  discipline_id: number;
  code: string;
  section_key: string;
  template_id: number | null;
}

export interface SimpleField {
  id: number;
  discipline_id: number;
  key: string;
  display_name: string;
  unit: string;
  decimal_places: number | null;
}

export interface CustomBlock {
  id: number;
  discipline_id: number;
  block_key: string;
  fields_json: Record<string, unknown>[];
}

export interface ComputedRecommendation {
  id: number;
  discipline_id: number;
  analyte_key: string;
  computation_type: string;
  params_json: Record<string, unknown>;
}

export interface Trigger {
  id: number;
  discipline_id: number;
  field: string;
  operator: string;
  threshold: number;
  action: string;
}

export interface ReportTemplate {
  id: number;
  discipline_id: number;
  name: string;
  sort_order: number;
  template_html: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateSummary {
  id: number;
  name: string;
  sort_order: number;
  placeholder_count: number;
}

export interface TemplateSection {
  id: number;
  discipline_id: number;
  section_key: string;
  display_name: string;
  sort_order: number;
  is_default: boolean;
  html_snippet: string;
}

export interface LabInfo {
  id: number;
  org_id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  logo_paths_json: Record<string, string>;
}

export interface Organization {
  id: number;
  name: string;
}


export interface FieldKey {
  id: number;
  discipline_id: number;
  name: string;
  display_name: string;
  data_type: string;
  date_format: string | null;
  decimal_places: number | null;
  column_refs: string[];
  placeholder_refs: string[];
}

export interface SpreadsheetColumn {
  id: number;
  discipline_id: number;
  internal_key: string;
  header_name: string;
  field_key_id: number | null;
  data_type: string | null;
  decimal_places: number | null;
  date_format: string | null;
  detected_type: string | null;
  flags: Record<string, unknown> | null;
  template_refs: string[];
}

export interface DetectedColumn {
  header: string;
  detected_type: string;
  sample_values: string[];
  flags: string[];
  suggested_key_id: number | null;
  suggested_key_name: string | null;
  match_confidence: "auto" | "suggested" | "unmapped";
  decimal_places: number | null;
}

export interface TemplatePlaceholder {
  id: number;
  placeholder_text: string;
  field_key_id: number | null;
  field_key_name: string | null;
  column_ref: string | null;
  match_confidence: "auto" | "suggested" | null;
}
