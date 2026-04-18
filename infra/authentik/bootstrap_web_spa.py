#!/usr/bin/env python3
"""
Idempotent Authentik bootstrap for this repo:
  - OAuth2 public client id web-spa + application slug web-spa
  - Profile scope mapping: realm_access.roles + groups from Authentik groups
  - Groups: consumer, builder, admin, platform-admin; assign to akadmin

Env:
  AUTHENTIK_BOOTSTRAP_URL  default http://127.0.0.1:8080/authentik
  AUTHENTIK_BOOTSTRAP_TOKEN  required (same as AUTHENTIK_BOOTSTRAP_TOKEN in .env)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_PM = {
    "openid": "c0fba9ff-e5ca-41c7-9714-81924ab6425d",
    "email": "78888f5d-a5bf-4495-ae5c-70bde4aad17a",
    "profile": "3b088d76-948a-4909-abfb-c4d9db040ef5",
}

# Allow OIDC end-session redirect back to the SPA (RP-initiated logout) and /login.
EXTRA_REDIRECT_URI_URLS = (
    "http://localhost:8080/",
    "http://127.0.0.1:8080/",
    "http://localhost:8080/login",
    "http://127.0.0.1:8080/login",
    "http://localhost:5173/login",
)


def req(
    method: str,
    url: str,
    *,
    token: str,
    data: dict | None = None,
) -> dict:
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(r) as resp:
            out = resp.read().decode()
            return json.loads(out) if out else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise SystemExit(f"HTTP {e.code} {method} {url}: {err}") from None


def flow_pk(base: str, token: str, slug: str) -> str:
    d = req("GET", f"{base}/api/v3/flows/instances/?slug={slug}", token=token)
    return str(d["results"][0]["pk"])


def merge_oauth2_redirect_uris(base: str, token: str, provider_pk: int | str) -> None:
    """Ensure post-logout (and /login) URLs are registered; Authentik may validate them."""
    p = req("GET", f"{base}/api/v3/providers/oauth2/{provider_pk}/", token=token)
    uris = list(p.get("redirect_uris") or [])
    seen = {x["url"] for x in uris if isinstance(x, dict) and "url" in x}
    added = False
    for url in EXTRA_REDIRECT_URI_URLS:
        if url not in seen:
            uris.append({"matching_mode": "strict", "url": url})
            seen.add(url)
            added = True
    if not added:
        return
    patch = {"redirect_uris": uris}
    req("PATCH", f"{base}/api/v3/providers/oauth2/{provider_pk}/", token=token, data=patch)


def main() -> None:
    base = os.environ.get("AUTHENTIK_BOOTSTRAP_URL", "http://127.0.0.1:8080/authentik").rstrip("/")
    token = os.environ.get("AUTHENTIK_BOOTSTRAP_TOKEN")
    if not token:
        print("Set AUTHENTIK_BOOTSTRAP_TOKEN", file=sys.stderr)
        sys.exit(1)
    check = req("GET", f"{base}/api/v3/providers/oauth2/?client_id=web-spa", token=token)
    n = check.get("count")
    if n is None:
        n = len(check.get("results") or [])
    if n >= 1:
        print("OAuth2 provider web-spa already exists.")
    else:
        print("Creating profile scope mapping...")
        mapping = req(
            "POST",
            f"{base}/api/v3/propertymappings/provider/scope/",
            token=token,
            data={
                "name": "e-ai-platform realm_access roles from groups",
                "scope_name": "profile",
                "expression": (
                    "roles = [group.name for group in request.user.ak_groups.all()]\n"
                    "return {\n"
                    '    "realm_access": {"roles": roles},\n'
                    '    "groups": roles,\n'
                    "}"
                ),
            },
        )
        mpk = mapping["pk"]
        print("Creating OAuth2 provider + application...")
        prov = req(
            "POST",
            f"{base}/api/v3/providers/oauth2/",
            token=token,
            data={
                "name": "Enterprise AI Platform SPA",
                "authentication_flow": flow_pk(base, token, "default-authentication-flow"),
                "authorization_flow": flow_pk(
                    base, token, "default-provider-authorization-implicit-consent"
                ),
                "invalidation_flow": flow_pk(base, token, "default-provider-invalidation-flow"),
                "client_type": "public",
                "client_id": "web-spa",
                "redirect_uris": [
                    {"matching_mode": "strict", "url": "http://localhost:8080/callback"},
                    {"matching_mode": "strict", "url": "http://127.0.0.1:8080/callback"},
                    {"matching_mode": "strict", "url": "http://localhost:5173/callback"},
                ]
                + [{"matching_mode": "strict", "url": u} for u in EXTRA_REDIRECT_URI_URLS],
                "property_mappings": [
                    DEFAULT_PM["openid"],
                    DEFAULT_PM["email"],
                    DEFAULT_PM["profile"],
                    mpk,
                ],
            },
        )
        provider_pk = prov["pk"]
        req(
            "POST",
            f"{base}/api/v3/core/applications/",
            token=token,
            data={
                "name": "Enterprise AI Platform",
                "slug": "web-spa",
                "provider": provider_pk,
            },
        )
        print("Created provider and application web-spa.")

    # Groups
    rbac = ["consumer", "builder", "admin", "platform-admin"]
    for name in rbac:
        g = req("GET", f"{base}/api/v3/core/groups/?name={name}", token=token)
        gc = g.get("count")
        if gc is None:
            gc = len(g.get("results") or [])
        if gc == 0:
            req("POST", f"{base}/api/v3/core/groups/", token=token, data={"name": name})
            print(f"Created group: {name}")

    users = req("GET", f"{base}/api/v3/core/users/?username=akadmin", token=token)
    if not users.get("results"):
        print("No akadmin user; skipping group assignment.")
        return
    user = users["results"][0]
    all_groups = req("GET", f"{base}/api/v3/core/groups/?page_size=500", token=token)["results"]
    want_names = set(rbac) | {"authentik Admins"}
    name_to_pk = {g["name"]: g["pk"] for g in all_groups}
    group_ids: list[str] = []
    for n in sorted(want_names):
        if n in name_to_pk:
            group_ids.append(name_to_pk[n])
    req(
        "PUT",
        f"{base}/api/v3/core/users/{user['pk']}/",
        token=token,
        data={
            "username": user["username"],
            "name": user.get("name") or user["username"],
            "email": user["email"],
            "is_active": user["is_active"],
            "groups": group_ids,
        },
    )
    print(f"Assigned groups to akadmin: {', '.join(sorted(want_names))}")
    chk = req("GET", f"{base}/api/v3/providers/oauth2/?client_id=web-spa", token=token)
    nres = chk.get("count")
    if nres is None:
        nres = len(chk.get("results") or [])
    if nres >= 1:
        pk = chk["results"][0]["pk"]
        try:
            merge_oauth2_redirect_uris(base, token, pk)
            print("OAuth2 redirect URIs updated (logout + /login allowlist if needed).")
        except SystemExit as e:
            print(f"Note: could not PATCH redirect URIs: {e}", file=sys.stderr)
    print("OIDC issuer: http://localhost:8080/authentik/application/o/web-spa/")


if __name__ == "__main__":
    main()
