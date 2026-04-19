/**
 * Thin fetch wrapper used by every page that talks to the backend.
 *
 * Routes: `/api/*` (api-service) and `/auth/*` (auth-service), proxied by nginx
 * or the Vite dev server. Bearer token is read from `sessionStorage`.
 */

const SESSION_TOKEN_KEY = "eai_access_token";

/** The SPA is backend-only; all entity and auth calls go through services. */
export const BACKEND_ENABLED = true;

/** Paths that must NOT trigger the auto-logout flow (else login itself bounces). */
const AUTH_BYPASS_PATHS = ["/auth/login"];

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

/**
 * Drop a stale/invalid token and notify the app so AuthContext can sign the
 * user out. Called on 401 from any request other than the login endpoint.
 */
function purgeSessionAndSignal(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eai-auth-invalidated"));
  }
}

async function throwForStatus(res: Response, path: string): Promise<never> {
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
  if (res.status === 401 && !AUTH_BYPASS_PATHS.some((p) => path.startsWith(p))) {
    purgeSessionAndSignal();
  }
  throw new ApiError(res.status, detail, message);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { ...authHeader() } });
  if (!res.ok) await throwForStatus(res, path);
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
  if (!res.ok) await throwForStatus(res, path);
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const apiPost = <T>(path: string, body?: unknown) => apiSend<T>("POST", path, body);
export const apiPut = <T>(path: string, body?: unknown) => apiSend<T>("PUT", path, body);
export const apiDelete = <T>(path: string, body?: unknown) => apiSend<T>("DELETE", path, body);
