/** Read role/group claims from OIDC access token (JWT) for RBAC in the SPA. */
export function realmRolesFromAccessToken(accessToken: string | null): Set<string> {
  if (!accessToken) return new Set();
  try {
    const part = accessToken.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as {
      realm_access?: { roles?: string[] };
      groups?: string[];
    };
    const out = new Set<string>();
    const ra = json.realm_access?.roles;
    if (Array.isArray(ra)) ra.forEach((r) => out.add(r));
    if (Array.isArray(json.groups)) json.groups.forEach((g) => out.add(String(g)));
    return out;
  } catch {
    /* ignore */
  }
  return new Set();
}
