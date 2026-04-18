import type { UserManagerSettings } from "oidc-client-ts";
import { WebStorageStateStore } from "oidc-client-ts";

const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? "http://localhost:9000/application/o/web-spa/";
const client_id = import.meta.env.VITE_OIDC_CLIENT_ID ?? "web-spa";

export function buildOidcSettings(): UserManagerSettings {
  const redirect_uri = `${window.location.origin}/callback`;
  const post_logout_redirect_uri = `${window.location.origin}/`;
  return {
    authority,
    client_id,
    redirect_uri,
    post_logout_redirect_uri,
    response_type: "code",
    scope: "openid profile email",
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: false,
  };
}
