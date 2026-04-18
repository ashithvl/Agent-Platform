import type { User } from "oidc-client-ts";

/** Read realm roles from Keycloak access token (JWT) for RBAC in the SPA. */
export function realmRolesFromUser(user: User | null): Set<string> {
  if (!user?.access_token) return new Set();
  try {
    const part = user.access_token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as { realm_access?: { roles?: string[] } };
    const roles = json.realm_access?.roles;
    if (Array.isArray(roles)) return new Set(roles);
  } catch {
    /* ignore */
  }
  return new Set();
}
