const base = import.meta.env.VITE_API_BASE ?? "/api/v1";

export async function apiFetch(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return res.json();
  return res.text();
}
