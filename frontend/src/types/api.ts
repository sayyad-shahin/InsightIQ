// Types mirroring the FastAPI backend schemas (app/schemas/*).

export type UserRole = "admin" | "analyst" | "viewer";
export type AuthProvider = "local" | "google";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  auth_provider: AuthProvider;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserStats {
  datasets: number;
  chats: number;
  forecasts: number;
  reports: number;
}

export type SourceType = "csv" | "excel" | "pdf" | "sql";
export type DatasetStatus = "uploaded" | "processing" | "cleaned" | "error";

export interface Dataset {
  id: string;
  name: string;
  source_type: SourceType;
  status: DatasetStatus;
  row_count: number | null;
  column_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetColumn {
  name: string;
  dtype: string;
}

export interface QualityReport {
  total_rows: number;
  missing_values: Record<string, { missing_count: number; missing_pct: number }>;
  duplicate_rows: number;
  outliers: Record<string, number>;
  suggestions: string[];
}

export interface DatasetDetail extends Dataset {
  schema_snapshot: { columns: DatasetColumn[] } | null;
  quality_report: QualityReport | null;
}

export interface DatasetPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  total_rows: number;
  previewed_rows: number;
}

export type ForecastModelType = "prophet" | "sklearn_regression";
export type ForecastStatus = "queued" | "running" | "done" | "failed";

export interface Forecast {
  id: string;
  dataset_id: string;
  target_column: string;
  model_type: ForecastModelType;
  horizon_periods: number;
  status: ForecastStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastMetrics {
  r2: number;
  mae: number;
  rmse: number;
}

export interface ForecastResult {
  model_used: string;
  history: number[];
  forecast: number[];
  lower?: number[];
  upper?: number[];
  confidence?: number;
  forecast_dates?: string[];
  horizon_periods: number;
  trend_slope?: number;
  metrics?: ForecastMetrics;
  note?: string;
}

export interface ForecastDetail extends Forecast {
  result: ForecastResult | null;
}

export type MessageRole = "user" | "assistant";
export type ResultType = "text" | "table" | "chart" | "none";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  result_type: ResultType;
  result_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface Chat {
  id: string;
  title: string;
  dataset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatDetail extends Chat {
  messages: ChatMessage[];
}

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "heatmap";

export interface ChartSeries {
  name: string;
  values: (number | null)[];
}

export interface ChartSpec {
  type: ChartType;
  title?: string;
  x?: (string | number)[];
  series?: ChartSeries[];
  x_title?: string;
  y_title?: string;
  // heatmap
  x_labels?: string[];
  y_labels?: string[];
  z?: (number | null)[][];
}

export interface ReportSections {
  overview: Record<string, unknown>;
  schema: { columns: DatasetColumn[] };
  data_quality: Record<string, unknown>;
}

export interface Report {
  id: string;
  dataset_id: string;
  title: string;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDetail extends Report {
  sections: ReportSections | null;
}

export type ThemePreference = "light" | "dark" | "system";

export interface UserSettings {
  theme: ThemePreference;
  language: string;
  preferences: Record<string, unknown> | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminStats {
  totals: { users: number; datasets: number; forecasts: number; reports: number; chats: number };
  users: { active: number; verified: number; new_this_week: number };
  datasets: { processing: number; errored: number };
  services: {
    database: boolean;
    redis_configured: boolean;
    celery_eager: boolean;
    ai_configured: boolean;
    environment: string;
  };
}

export interface ColumnStats {
  count: number;
  mean: number;
  std: number;
  min: number;
  q25: number;
  median: number;
  q75: number;
  max: number;
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: (number | null)[][];
}

export type Distribution =
  | { type: "numeric"; bins: { start: number; end: number; count: number }[] }
  | { type: "categorical"; values: { value: string; count: number }[] };

export interface DatasetStatistics {
  row_count: number;
  column_count: number;
  quality_score: number;
  statistics: Record<string, ColumnStats>;
  correlation: CorrelationMatrix | null;
  distributions: Record<string, Distribution>;
}

export interface CleaningOperations {
  remove_duplicates: boolean;
  fill_missing: boolean;
  drop_empty_rows: boolean;
  convert_types: boolean;
  normalize_dates: boolean;
  trim_whitespace: boolean;
  fill_strategy: "auto" | "mean" | "median" | "zero";
}

export interface CleaningSummary {
  rows_before: number;
  rows_after: number;
  rows_removed: number;
  missing_before: number;
  missing_after: number;
  duplicates_before: number;
  duplicates_after: number;
  operations_applied: string[];
}

export interface CleaningPreview {
  summary: CleaningSummary;
  preview: DatasetPreview;
}

// --- Analytics bundle (GET /datasets/{id}/analytics) -----------------------

export interface AnalyticsMeasure {
  name: string;
  total: number;
  mean: number;
  min: number;
  max: number;
  is_primary: boolean;
}

export interface AnalyticsKpis {
  row_count: number;
  column_count: number;
  quality_score: number;
  completeness: number;
  numeric_count: number;
  measures: AnalyticsMeasure[];
}

export interface TrendBlock {
  change_pct: number;
  direction: "up" | "down" | "flat";
  peak: { date: string; value: number };
  chart: ChartSpec;
}

export interface BreakdownBlock {
  dimension: string;
  measure: string;
  rows: { name: string; value: number; pct: number }[];
  bar: ChartSpec;
  pie: ChartSpec;
}

export interface AnomalyItem {
  column: string;
  count: number;
  pct: number;
  severity: "low" | "medium" | "high";
  lower_bound: number;
  upper_bound: number;
  extremes: number[];
  root_cause: string;
}

export interface BusinessInsights {
  key_insights: string[];
  opportunities: string[];
  risks: string[];
  revenue_drivers: string[];
  growth_trends: string[];
  recommendations: string[];
}

export interface DatasetAnalytics {
  primary_measure: string | null;
  dimension: string | null;
  date_column: string | null;
  options: { measures: string[]; dimensions: string[]; date_columns: string[] };
  kpis: AnalyticsKpis;
  trend: TrendBlock | null;
  category_breakdown: BreakdownBlock | null;
  segmentation: { measure: string; chart: ChartSpec } | null;
  geographic: { column: string; chart: ChartSpec } | null;
  correlation: { chart: ChartSpec; top_pairs: { a: string; b: string; value: number }[] } | null;
  distributions: Record<string, Distribution>;
  missing_values: {
    columns: { name: string; missing_count: number; missing_pct: number }[];
    duplicate_rows: number;
  };
  anomalies: { items: AnomalyItem[]; chart: ChartSpec | null; recommendations: string[] };
  insights: BusinessInsights;
}
