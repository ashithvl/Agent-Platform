/**
 * Thin fetch wrapper used by every page that talks to a real backend.
 *
 * Backends live behind nginx at /api (api-service) and /auth (auth-service).
 * The SPA ships bearer tokens from `sessionStorage` on every call; no cookies,
 * no CSRF complexity.
 *
 * A compile-time feature flag (`VITE_USE_BACKEND=1`) lets each localStorage
 * module fall back to in-browser storage while the Phase-5 migrations land.
 */

const SESSION_TOKEN_KEY = "eai_access_token";

export const BACKEND_ENABLED: boolean =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_USE_BACKEND === "1";

function authHeader(): Record<string, string> {
  const t = sessionStorage.getItem(SESSION_TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function throwForStatus(res: Response): Promise<never> {
  let detail: unknown = null;
  let message = `${res.status} ${res.statusText}`;
  try {
    detail = await res.json();
    if (detail && typeof detail === "object" && "detail" in detail) {
      const d = (detail as { detail: unknown }).detail;
      if (typeof d === "string") message = d;
    }
  } catch {
    /* body is not JSON; keep the status line as the message */
  }
  throw new ApiError(res.status, detail, message);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { ...authHeader() } });
  if (!res.ok) await throwForStatus(res);
  return (await res.json()) as T;
}

export async function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) await throwForStatus(res);
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const apiPost = <T>(path: string, body?: unknown) => apiSend<T>("POST", path, body);
export const apiPut = <T>(path: string, body?: unknown) => apiSend<T>("PUT", path, body);
export const apiDelete = <T>(path: string, body?: unknown) => apiSend<T>("DELETE", path, body);
