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

export interface ForecastResult {
  model_used: string;
  history: number[];
  forecast: number[];
  forecast_dates?: string[];
  horizon_periods: number;
  trend_slope?: number;
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
