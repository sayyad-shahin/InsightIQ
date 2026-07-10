import type {
  AdminStats,
  AuditLog,
  Chat,
  ChatDetail,
  ChatMessage,
  CleaningOperations,
  CleaningPreview,
  Dataset,
  DatasetAnalytics,
  DatasetDetail,
  DatasetPreview,
  DatasetStatistics,
  Forecast,
  ForecastDetail,
  ForecastModelType,
  QualityReport,
  Report,
  ReportDetail,
  TokenResponse,
  User,
  UserRole,
  UserSettings,
  UserStats,
} from "@/types/api";

/** Build a ?limit&offset query string (both optional). */
function page(limit?: number, offset?: number): string {
  const p = new URLSearchParams();
  if (limit != null) p.set("limit", String(limit));
  if (offset != null) p.set("offset", String(offset));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

const BASE = "/api/v1";

/** Read the JS-readable CSRF cookie for the double-submit header on writes. */
export function csrfHeaders(method: string): Record<string, string> {
  if (method === "GET" || method === "HEAD") return {};
  const match = document.cookie.match(/(?:^|;\s*)iq_csrf=([^;]+)/);
  return match ? { "X-CSRF-Token": decodeURIComponent(match[1]) } : {};
}

/** A logged-in session leaves a readable iq_csrf cookie (access/refresh are httpOnly). */
function hasSessionCookie(): boolean {
  return /(?:^|;\s*)iq_csrf=/.test(document.cookie);
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
    if (typeof b.detail === "string") return b.detail;
    if (Array.isArray(b.detail) && b.detail.length) {
      const first = b.detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  }
  return fallback;
}

let refreshPromise: Promise<boolean> | null = null;

/** Silently rotate the session using the httpOnly refresh cookie. */
async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
          credentials: "include",
          body: "{}",
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, isForm = false, signal } = opts;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { ...csrfHeaders(method) };
    if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "include", // send/receive httpOnly auth cookies
      signal,
      body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // On 401, try one silent cookie refresh + retry — only if a session exists and
  // this isn't itself an auth endpoint.
  if (res.status === 401 && !path.startsWith("/auth/") && hasSessionCookie()) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(payload, `Request failed (${res.status})`), payload);
  }
  return payload as T;
}

export const api = {
  auth: {
    signup: (data: { email: string; full_name: string; password: string }) =>
      request<User>("/auth/signup", { method: "POST", body: data, auth: false }),
    login: (data: { email: string; password: string }) =>
      request<TokenResponse>("/auth/login", { method: "POST", body: data, auth: false }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    forgotPassword: (email: string) =>
      request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
    resetPassword: (token: string, new_password: string) =>
      request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, new_password },
        auth: false,
      }),
    googleLoginUrl: () => `${BASE}/auth/google/login`,
  },
  users: {
    me: () => request<User>("/users/me"),
    stats: () => request<UserStats>("/users/me/stats"),
    updateMe: (data: { full_name?: string }) => request<User>("/users/me", { method: "PATCH", body: data }),
    changePassword: (current_password: string, new_password: string) =>
      request<{ message: string }>("/users/me/password", {
        method: "POST",
        body: { current_password, new_password },
      }),
    list: () => request<User[]>("/users"),
    updateRole: (userId: string, role: UserRole) =>
      request<User>(`/users/${userId}/role`, { method: "PATCH", body: { role } }),
  },
  admin: {
    stats: () => request<AdminStats>("/admin/stats"),
  },
  settings: {
    get: () => request<UserSettings>("/settings/me"),
    update: (data: Partial<UserSettings>) => request<UserSettings>("/settings/me", { method: "PATCH", body: data }),
  },
  datasets: {
    list: (limit?: number, offset?: number) => request<Dataset[]>(`/datasets${page(limit, offset)}`),
    get: (id: string) => request<DatasetDetail>(`/datasets/${id}`),
    preview: (id: string, limit = 100) => request<DatasetPreview>(`/datasets/${id}/preview?limit=${limit}`),
    qualityReport: (id: string) => request<QualityReport>(`/datasets/${id}/quality-report`),
    statistics: (id: string) => request<DatasetStatistics>(`/datasets/${id}/statistics`),
    analytics: (id: string, opts?: { measure?: string; dimension?: string }) => {
      const params = new URLSearchParams();
      if (opts?.measure) params.set("measure", opts.measure);
      if (opts?.dimension) params.set("dimension", opts.dimension);
      const qs = params.toString();
      return request<DatasetAnalytics>(`/datasets/${id}/analytics${qs ? `?${qs}` : ""}`);
    },
    rename: (id: string, name: string) =>
      request<Dataset>(`/datasets/${id}`, { method: "PATCH", body: { name } }),
    duplicate: (id: string) => request<Dataset>(`/datasets/${id}/duplicate`, { method: "POST" }),
    download: (id: string, filename: string) => downloadDataset(id, filename),
    cleanPreview: (id: string, ops: CleaningOperations) =>
      request<CleaningPreview>(`/datasets/${id}/clean/preview`, { method: "POST", body: ops }),
    cleanApply: (id: string, ops: CleaningOperations) =>
      request<DatasetDetail>(`/datasets/${id}/clean/apply`, { method: "POST", body: ops }),
    cleanUndo: (id: string) => request<DatasetDetail>(`/datasets/${id}/clean/undo`, { method: "POST" }),
    remove: (id: string) => request<void>(`/datasets/${id}`, { method: "DELETE" }),
    upload: (file: File, onProgress?: (pct: number) => void) => uploadWithProgress(file, onProgress),
    createUpload: (file: File, onProgress?: (pct: number) => void) => createCancellableUpload(file, onProgress),
  },
  forecasts: {
    list: (datasetId?: string, limit?: number) => {
      const p = new URLSearchParams();
      if (datasetId) p.set("dataset_id", datasetId);
      if (limit != null) p.set("limit", String(limit));
      const qs = p.toString();
      return request<Forecast[]>(`/forecasts${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<ForecastDetail>(`/forecasts/${id}`),
    create: (data: {
      dataset_id: string;
      target_column: string;
      model_type?: ForecastModelType;
      horizon_periods?: number;
    }) => request<Forecast>("/forecasts", { method: "POST", body: data }),
    remove: (id: string) => request<void>(`/forecasts/${id}`, { method: "DELETE" }),
  },
  chats: {
    list: (limit?: number, offset?: number) => request<Chat[]>(`/chats${page(limit, offset)}`),
    get: (id: string) => request<ChatDetail>(`/chats/${id}`),
    create: (data: { title?: string; dataset_id?: string | null }) =>
      request<Chat>("/chats", { method: "POST", body: data }),
    sendMessage: (chatId: string, content: string) =>
      request<ChatMessage>(`/chats/${chatId}/messages`, { method: "POST", body: { content } }),
    rename: (id: string, title: string) =>
      request<Chat>(`/chats/${id}`, { method: "PATCH", body: { title } }),
    streamMessage: (chatId: string, content: string, handlers: StreamHandlers, signal?: AbortSignal) =>
      streamChatMessage(chatId, content, handlers, signal),
    remove: (id: string) => request<void>(`/chats/${id}`, { method: "DELETE" }),
  },
  reports: {
    list: (limit?: number, offset?: number) => request<Report[]>(`/reports${page(limit, offset)}`),
    get: (id: string) => request<ReportDetail>(`/reports/${id}`),
    create: (data: { dataset_id: string; title: string }) =>
      request<ReportDetail>("/reports", { method: "POST", body: data }),
    downloadPdf: (id: string, title: string) => downloadBlob(`/reports/${id}/download`, `${title}.pdf`),
    remove: (id: string) => request<void>(`/reports/${id}`, { method: "DELETE" }),
  },
  audit: {
    list: (limit = 50, offset = 0) => request<AuditLog[]>(`/audit-logs?limit=${limit}&offset=${offset}`),
  },
};

/** Upload with real progress via XHR (fetch lacks upload progress events). */
function uploadWithProgress(file: File, onProgress?: (pct: number) => void): Promise<Dataset> {
  return createCancellableUpload(file, onProgress).promise;
}

export interface CancellableUpload {
  promise: Promise<Dataset>;
  abort: () => void;
}

/** Upload that can be cancelled mid-flight (for the upload queue). */
function createCancellableUpload(file: File, onProgress?: (pct: number) => void): CancellableUpload {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Dataset>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    xhr.open("POST", `${BASE}/datasets/upload`);
    xhr.withCredentials = true;
    const csrf = csrfHeaders("POST")["X-CSRF-Token"];
    if (csrf) xhr.setRequestHeader("X-CSRF-Token", csrf);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload as Dataset);
      else reject(new ApiError(xhr.status, extractMessage(payload, "Upload failed"), payload));
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled"));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export interface StreamHandlers {
  onToken: (chunk: string) => void;
  onDone: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
}

/** Consume the assistant reply as a server-sent-events stream (POST + bearer). */
async function streamChatMessage(
  chatId: string,
  content: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/chats/${chatId}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
    credentials: "include",
    body: JSON.stringify({ content }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, "Failed to start stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const line = evt.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim()) as
          | { type: "token"; content: string }
          | { type: "done"; message: ChatMessage };
        if (payload.type === "token") handlers.onToken(payload.content);
        else if (payload.type === "done") handlers.onDone(payload.message);
      } catch {
        /* ignore malformed keep-alive lines */
      }
    }
  }
}

/** Authenticated file download via blob (a plain link can't send the bearer token). */
async function downloadBlob(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const downloadDataset = (id: string, filename: string) => downloadBlob(`/datasets/${id}/download`, filename);
