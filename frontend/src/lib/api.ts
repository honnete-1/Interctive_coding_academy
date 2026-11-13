/**
 * Typed client for the Django API (proxied at /api by next.config.ts).
 * Session cookie auth; unsafe methods echo the csrftoken cookie as X-CSRFToken.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

let csrfReady: Promise<void> | null = null;
async function ensureCsrf() {
  if (readCookie("csrftoken")) return;
  csrfReady ??= fetch("/api/auth/csrf", { credentials: "same-origin" }).then(() => undefined);
  await csrfReady;
  csrfReady = null;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") {
    await ensureCsrf();
    headers["X-CSRFToken"] = readCookie("csrftoken") ?? "";
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the CodeVerse server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON (e.g. proxy error page) */
  }
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
    if (err) throw new ApiError(res.status, err.code, err.message, err.details);
    const fallback = res.status >= 500 ? "The server had a problem. Please try again shortly." : `Request failed (${res.status}).`;
    throw new ApiError(res.status, "http_error", fallback);
  }
  return data as T;
}

/** Flattens DRF field errors ({field: [msg]}) into readable strings. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details || typeof err.details !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.details as Record<string, unknown>)) {
    out[k] = Array.isArray(v) ? v.join(" ") : String(v);
  }
  return out;
}
