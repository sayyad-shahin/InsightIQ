import type { SourceType } from "@/types/api";

// Mirrors the backend allow-list (app/utils/file_validation.py) and 100MB cap.
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const EXT_TO_TYPE: Record<string, SourceType> = {
  csv: "csv",
  xlsx: "excel",
  xls: "excel",
  pdf: "pdf",
  sql: "sql",
};

export const ACCEPTED_EXTENSIONS = Object.keys(EXT_TO_TYPE).map((e) => `.${e}`);
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function detectSourceType(filename: string): SourceType | null {
  return EXT_TO_TYPE[extensionOf(filename)] ?? null;
}

export interface FileValidation {
  ok: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidation {
  const type = detectSourceType(file.name);
  if (!type) {
    return { ok: false, error: `Unsupported type. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}` };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File exceeds the 100MB limit" };
  }
  return { ok: true };
}

/** Stable key for duplicate detection within a session. */
export function fileKey(file: File): string {
  return `${file.name}:${file.size}`;
}
